import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JournalService, deriveStatus } from './journal.service.js';
import { JournalPhotoStorage } from './journal-photo-storage.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JournalEntryDto } from './dto/journal.js';

type AsyncMock = jest.Mock<(...args: any[]) => Promise<any>>;

// O "data" passado na chamada n do mock do Prisma.
function dataOf(mock: AsyncMock, call = 0) {
  return (mock.mock.calls[call][0] as { data: Record<string, unknown> }).data;
}

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);

describe('JournalService', () => {
  let service: JournalService;
  let prisma: {
    journalEntry: {
      findFirst: AsyncMock;
      findMany: AsyncMock;
      create: AsyncMock;
      update: AsyncMock;
      delete: AsyncMock;
    };
    filament: { findFirst: AsyncMock };
  };
  let storage: { save: AsyncMock; remove: AsyncMock };

  const userId = 'user-1';
  const entryId = 'entry-1';
  const filamentId = '0b6c5a3e-1d0a-4c2b-9a51-1c1f3e2d4b5a';
  // Como o Prisma devolve, com as relações do include.
  const entry = {
    id: entryId,
    title: 'Warping',
    occurredAt: new Date('2026-07-27T12:00:00.000Z'),
    status: 'RESOLVED',
    symptom: 'Pontas levantaram',
    possibleCauses: 'Mesa fria',
    notes: null,
    filamentId,
    filament: {
      id: filamentId,
      colorName: 'Preto Velvet',
      type: 'PLA Matte',
      colors: ['#1e1f28'],
      brand: { name: 'Voolt3D' },
    },
    attempts: [
      {
        id: 'att-1',
        description: 'Limpar a mesa',
        outcome: 'FAILED',
        triedAt: new Date('2026-07-27T12:00:00.000Z'),
        note: null,
      },
      {
        id: 'att-2',
        description: 'Brim de 5 mm',
        outcome: 'WORKED',
        triedAt: new Date('2026-07-31T12:00:00.000Z'),
        note: null,
      },
    ],
    photos: [{ id: 'photo-1', filename: 'abc.jpg' }],
  };
  const input: JournalEntryDto = {
    title: '  Warping  ',
    occurredAt: '2026-07-27T12:00:00.000Z',
    symptom: ' Pontas levantaram ',
    filamentId,
    attempts: [
      {
        description: 'Limpar a mesa',
        outcome: 'FAILED',
        triedAt: '2026-07-27T12:00:00.000Z',
      },
      { description: '   ', triedAt: '2026-07-28T12:00:00.000Z' },
      {
        description: ' Brim de 5 mm ',
        outcome: 'WORKED',
        triedAt: '2026-07-31T12:00:00.000Z',
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      journalEntry: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      filament: { findFirst: jest.fn() },
    };
    storage = { save: jest.fn(), remove: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JournalService,
        { provide: PrismaService, useValue: prisma },
        { provide: JournalPhotoStorage, useValue: storage },
      ],
    }).compile();

    service = module.get<JournalService>(JournalService);
  });

  describe('deriveStatus', () => {
    it('é RESOLVED quando alguma tentativa funcionou', () => {
      expect(
        deriveStatus(
          [{ outcome: 'FAILED' }, { outcome: 'WORKED' }],
          'UNRESOLVED',
        ),
      ).toBe('RESOLVED');
    });

    it('usa o status aberto quando nenhuma funcionou', () => {
      expect(deriveStatus([{ outcome: null }], 'UNRESOLVED')).toBe(
        'UNRESOLVED',
      );
      expect(deriveStatus([], 'IN_PROGRESS')).toBe('IN_PROGRESS');
    });
  });

  describe('createEntry', () => {
    it('lança NotFoundException se o filamento não é do usuário', async () => {
      prisma.filament.findFirst.mockResolvedValue(null);

      await expect(service.createEntry(userId, input)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.filament.findFirst).toHaveBeenCalledWith({
        where: { id: filamentId, userId },
        select: { id: true },
      });
      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    });

    it('lança BadRequestException com mais de uma tentativa que resolveu', async () => {
      prisma.filament.findFirst.mockResolvedValue({ id: filamentId });

      await expect(
        service.createEntry(userId, {
          ...input,
          attempts: [
            { description: 'A', outcome: 'WORKED', triedAt: input.occurredAt },
            { description: 'B', outcome: 'WORKED', triedAt: input.occurredAt },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança BadRequestException se o título é só espaço', async () => {
      await expect(
        service.createEntry(userId, {
          ...input,
          filamentId: null,
          title: '  ',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('apara textos, descarta tentativas em branco, numera e deriva o status', async () => {
      prisma.filament.findFirst.mockResolvedValue({ id: filamentId });
      prisma.journalEntry.create.mockResolvedValue(entry);

      await service.createEntry(userId, { ...input, openStatus: 'UNRESOLVED' });

      const data = dataOf(prisma.journalEntry.create);
      expect(data).toMatchObject({
        title: 'Warping',
        symptom: 'Pontas levantaram',
        possibleCauses: '',
        notes: null,
        status: 'RESOLVED',
        filamentId,
        userId,
      });
      expect(data.attempts).toEqual({
        create: [
          {
            position: 0,
            description: 'Limpar a mesa',
            outcome: 'FAILED',
            triedAt: '2026-07-27T12:00:00.000Z',
            note: null,
          },
          {
            position: 1,
            description: 'Brim de 5 mm',
            outcome: 'WORKED',
            triedAt: '2026-07-31T12:00:00.000Z',
            note: null,
          },
        ],
      });
    });

    it('fica em andamento por padrão quando nada resolveu', async () => {
      prisma.journalEntry.create.mockResolvedValue(entry);

      await service.createEntry(userId, {
        ...input,
        filamentId: undefined,
        attempts: [],
      });

      expect(dataOf(prisma.journalEntry.create).status).toBe('IN_PROGRESS');
      expect(prisma.filament.findFirst).not.toHaveBeenCalled();
    });

    it('devolve o filamento achatado e as fotos com URL', async () => {
      prisma.filament.findFirst.mockResolvedValue({ id: filamentId });
      prisma.journalEntry.create.mockResolvedValue(entry);

      const result = await service.createEntry(userId, input);

      expect(result.data.filament).toEqual({
        id: filamentId,
        colorName: 'Preto Velvet',
        type: 'PLA Matte',
        colors: ['#1e1f28'],
        brandName: 'Voolt3D',
      });
      expect(result.data.photos).toEqual([
        { id: 'photo-1', url: '/uploads/journal/abc.jpg' },
      ]);
    });
  });

  describe('getEntryById', () => {
    it('lança NotFoundException se a entrada não é do usuário', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(null);

      await expect(service.getEntryById(entryId, userId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.journalEntry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: entryId, userId } }),
      );
    });
  });

  describe('updateEntry', () => {
    it('substitui as tentativas quando vêm no corpo', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(entry);
      prisma.journalEntry.update.mockResolvedValue(entry);

      await service.updateEntry(entryId, userId, {
        attempts: [{ description: 'Novo teste', triedAt: input.occurredAt }],
      });

      const data = dataOf(prisma.journalEntry.update);
      expect(data.attempts).toEqual({
        deleteMany: {},
        create: [
          {
            position: 0,
            description: 'Novo teste',
            outcome: null,
            triedAt: input.occurredAt,
            note: null,
          },
        ],
      });
      // A que resolveu saiu: volta para em andamento.
      expect(data.status).toBe('IN_PROGRESS');
    });

    it('sem tentativas no corpo, mantém as atuais e o status derivado delas', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(entry);
      prisma.journalEntry.update.mockResolvedValue(entry);

      await service.updateEntry(entryId, userId, { title: 'Novo título' });

      const data = dataOf(prisma.journalEntry.update);
      expect(data.attempts).toBeUndefined();
      expect(data.status).toBe('RESOLVED');
      expect(data.title).toBe('Novo título');
    });

    it('mantém não resolvido quando o status atual é esse', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue({
        ...entry,
        status: 'UNRESOLVED',
        attempts: [],
      });
      prisma.journalEntry.update.mockResolvedValue(entry);

      await service.updateEntry(entryId, userId, { notes: 'x' });

      expect(dataOf(prisma.journalEntry.update).status).toBe('UNRESOLVED');
    });

    it('filamentId null desvincula o filamento sem consultar', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(entry);
      prisma.journalEntry.update.mockResolvedValue(entry);

      await service.updateEntry(entryId, userId, { filamentId: null });

      expect(prisma.filament.findFirst).not.toHaveBeenCalled();
      expect(dataOf(prisma.journalEntry.update).filamentId).toBeNull();
    });
  });

  describe('deleteEntry', () => {
    it('exclui a entrada e depois os arquivos das fotos', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(entry);
      prisma.journalEntry.delete.mockResolvedValue(entry);

      await service.deleteEntry(entryId, userId);

      expect(prisma.journalEntry.delete).toHaveBeenCalledWith({
        where: { id: entryId },
      });
      expect(storage.remove).toHaveBeenCalledWith('abc.jpg');
    });

    it('não toca nos arquivos se a entrada não é do usuário', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(null);

      await expect(service.deleteEntry(entryId, userId)).rejects.toThrow(
        NotFoundException,
      );
      expect(storage.remove).not.toHaveBeenCalled();
    });
  });

  describe('addPhotos', () => {
    it('rejeita arquivo que não é imagem, sem gravar nada', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(entry);

      await expect(
        service.addPhotos(entryId, userId, [
          { buffer: PNG },
          { buffer: Buffer.from('<svg onload="alert(1)">') },
        ]),
      ).rejects.toThrow(BadRequestException);
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('rejeita quando passaria do limite de fotos', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue({
        ...entry,
        photos: Array.from({ length: 12 }, (_, i) => ({
          id: `p${i}`,
          filename: `${i}.jpg`,
        })),
      });

      await expect(
        service.addPhotos(entryId, userId, [{ buffer: JPG }]),
      ).rejects.toThrow(BadRequestException);
    });

    it('grava com a extensão detectada pelo conteúdo', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(entry);
      storage.save
        .mockResolvedValueOnce('new-1.png')
        .mockResolvedValueOnce('new-2.jpg');
      prisma.journalEntry.update.mockResolvedValue(entry);

      await service.addPhotos(entryId, userId, [
        { buffer: PNG },
        { buffer: JPG },
      ]);

      expect(storage.save).toHaveBeenNthCalledWith(1, PNG, 'png');
      expect(storage.save).toHaveBeenNthCalledWith(2, JPG, 'jpg');
      expect(dataOf(prisma.journalEntry.update)).toEqual({
        photos: {
          create: [{ filename: 'new-1.png' }, { filename: 'new-2.jpg' }],
        },
      });
    });

    it('apaga os arquivos gravados se o banco falhar', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(entry);
      storage.save.mockResolvedValue('new-1.png');
      prisma.journalEntry.update.mockRejectedValue(new Error('db down'));

      await expect(
        service.addPhotos(entryId, userId, [{ buffer: PNG }]),
      ).rejects.toThrow('db down');
      expect(storage.remove).toHaveBeenCalledWith('new-1.png');
    });
  });

  describe('deletePhoto', () => {
    it('lança NotFoundException para foto de outra entrada', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(entry);

      await expect(
        service.deletePhoto(entryId, 'other-photo', userId),
      ).rejects.toThrow(NotFoundException);
      expect(storage.remove).not.toHaveBeenCalled();
    });

    it('remove o registro e o arquivo', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(entry);
      prisma.journalEntry.update.mockResolvedValue({ ...entry, photos: [] });

      const result = await service.deletePhoto(entryId, 'photo-1', userId);

      expect(dataOf(prisma.journalEntry.update)).toEqual({
        photos: { delete: { id: 'photo-1' } },
      });
      expect(storage.remove).toHaveBeenCalledWith('abc.jpg');
      expect(result.data.photos).toEqual([]);
    });
  });
});
