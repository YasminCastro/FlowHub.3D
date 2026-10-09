import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { BrandService } from './brand.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';

type AsyncMock = jest.Mock<(...args: any[]) => Promise<any>>;

describe('BrandService', () => {
  let service: BrandService;
  let prisma: {
    brand: {
      findFirst: AsyncMock;
      findMany: AsyncMock;
      create: AsyncMock;
      update: AsyncMock;
      delete: AsyncMock;
    };
    brandNote: {
      findFirst: AsyncMock;
      create: AsyncMock;
      update: AsyncMock;
      delete: AsyncMock;
    };
  };

  const userId = 'user-1';
  const brandId = 'brand-1';
  const noteId = 'note-1';
  const brand = { id: brandId, name: 'Voolt3D', archivedAt: null, notes: [] };

  beforeEach(async () => {
    prisma = {
      brand: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      brandNote: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [BrandService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<BrandService>(BrandService);
  });

  describe('createBrand', () => {
    it('lança ConflictException se já existe marca com o mesmo nome (sem diferenciar maiúsculas)', async () => {
      prisma.brand.findFirst.mockResolvedValue(brand);

      await expect(
        service.createBrand(userId, { name: 'voolt3d' }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.brand.findFirst).toHaveBeenCalledWith({
        where: { userId, name: { equals: 'voolt3d', mode: 'insensitive' } },
      });
      expect(prisma.brand.create).not.toHaveBeenCalled();
    });

    it('cria a marca e transforma a observação inicial em nota', async () => {
      prisma.brand.findFirst.mockResolvedValue(null);
      prisma.brand.create.mockResolvedValue(brand);

      const result = await service.createBrand(userId, {
        name: '  Voolt3D ',
        purchaseChannels: ['OWN_SITE', 'SHOPEE'],
        filamentTypes: ['PLA', 'PETG'],
        notes: 'Linha outlet vale a pena.',
      });

      expect(prisma.brand.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            name: 'Voolt3D',
            purchaseChannels: ['OWN_SITE', 'SHOPEE'],
            filamentTypes: ['PLA', 'PETG'],
            userId,
            notes: { create: { content: 'Linha outlet vale a pena.' } },
          },
        }),
      );
      expect(result).toEqual({
        message: 'Marca criada com sucesso',
        data: brand,
      });
    });

    it('não cria nota quando a observação está vazia', async () => {
      prisma.brand.findFirst.mockResolvedValue(null);
      prisma.brand.create.mockResolvedValue(brand);

      await service.createBrand(userId, { name: 'Voolt3D', notes: '   ' });

      expect(prisma.brand.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { name: 'Voolt3D', userId } }),
      );
    });
  });

  describe('getAllBrands', () => {
    it('lista só as marcas ativas por padrão', async () => {
      prisma.brand.findMany.mockResolvedValue([brand]);

      await service.getAllBrands(userId);

      expect(prisma.brand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId, archivedAt: null } }),
      );
    });

    it('lista as arquivadas quando pedido', async () => {
      prisma.brand.findMany.mockResolvedValue([]);

      await service.getAllBrands(userId, true);

      expect(prisma.brand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, archivedAt: { not: null } },
        }),
      );
    });
  });

  describe('getBrandById', () => {
    it('lança NotFoundException se a marca não for do usuário', async () => {
      prisma.brand.findFirst.mockResolvedValue(null);

      await expect(service.getBrandById(brandId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateBrand', () => {
    it('ignora a própria marca ao checar nome duplicado', async () => {
      prisma.brand.findFirst
        .mockResolvedValueOnce(brand)
        .mockResolvedValueOnce(null);
      prisma.brand.update.mockResolvedValue(brand);

      await service.updateBrand(brandId, userId, { name: 'VOOLT3D' });

      expect(prisma.brand.findFirst).toHaveBeenLastCalledWith({
        where: {
          userId,
          name: { equals: 'VOOLT3D', mode: 'insensitive' },
          id: { not: brandId },
        },
      });
    });

    it('lança ConflictException ao renomear para o nome de outra marca', async () => {
      prisma.brand.findFirst
        .mockResolvedValueOnce(brand)
        .mockResolvedValueOnce({ id: 'brand-2' });

      await expect(
        service.updateBrand(brandId, userId, { name: 'Elegoo' }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.brand.update).not.toHaveBeenCalled();
    });

    it('arquiva com a data atual e desarquiva limpando a data', async () => {
      prisma.brand.findFirst.mockResolvedValue(brand);
      prisma.brand.update.mockResolvedValue(brand);

      await service.updateBrand(brandId, userId, { archived: true });
      const archiveCall = prisma.brand.update.mock.calls[0][0] as {
        data: { archivedAt: Date };
      };
      expect(archiveCall.data.archivedAt).toBeInstanceOf(Date);

      await service.updateBrand(brandId, userId, { archived: false });
      expect(prisma.brand.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: { archivedAt: null } }),
      );
    });

    it('não move a data de uma marca já arquivada', async () => {
      prisma.brand.findFirst.mockResolvedValue({
        ...brand,
        archivedAt: new Date('2026-08-01'),
      });
      prisma.brand.update.mockResolvedValue(brand);

      await service.updateBrand(brandId, userId, { archived: true });

      expect(prisma.brand.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: {} }),
      );
    });
  });

  describe('nome e observação em branco', () => {
    it('lança BadRequestException quando o nome é só espaços', async () => {
      await expect(
        service.createBrand(userId, { name: '   ' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.brand.create).not.toHaveBeenCalled();
    });

    it('lança BadRequestException quando a observação é só espaços', async () => {
      prisma.brand.findFirst.mockResolvedValue(brand);

      await expect(
        service.addNote(brandId, userId, { content: '  \n ' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.brandNote.create).not.toHaveBeenCalled();
    });
  });

  describe('nome duplicado gravado ao mesmo tempo', () => {
    const uniqueViolation = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: 'test' },
    );

    it('converte o P2002 do create em ConflictException', async () => {
      prisma.brand.findFirst.mockResolvedValue(null);
      prisma.brand.create.mockRejectedValue(uniqueViolation);

      await expect(
        service.createBrand(userId, { name: 'Voolt3D' }),
      ).rejects.toThrow(ConflictException);
    });

    it('converte o P2002 do update em ConflictException', async () => {
      prisma.brand.findFirst
        .mockResolvedValueOnce(brand)
        .mockResolvedValueOnce(null);
      prisma.brand.update.mockRejectedValue(uniqueViolation);

      await expect(
        service.updateBrand(brandId, userId, { name: 'Elegoo' }),
      ).rejects.toThrow(ConflictException);
    });

    it('deixa passar outros erros do banco', async () => {
      prisma.brand.findFirst.mockResolvedValue(null);
      prisma.brand.create.mockRejectedValue(new Error('conexão caiu'));

      await expect(
        service.createBrand(userId, { name: 'Voolt3D' }),
      ).rejects.toThrow('conexão caiu');
    });
  });

  describe('cores preferidas', () => {
    it('salva sem espaços e sem repetir a mesma cor', async () => {
      prisma.brand.findFirst.mockResolvedValue(null);
      prisma.brand.create.mockResolvedValue(brand);

      await service.createBrand(userId, {
        name: 'Voolt3D',
        preferredColors: [' Pastéis ', 'Preto', 'preto', 'Branco'],
      });

      expect(prisma.brand.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            name: 'Voolt3D',
            userId,
            preferredColors: ['Pastéis', 'Preto', 'Branco'],
          },
        }),
      );
    });

    it('na edição, a lista enviada substitui a anterior', async () => {
      prisma.brand.findFirst.mockResolvedValue(brand);
      prisma.brand.update.mockResolvedValue(brand);

      await service.updateBrand(brandId, userId, { preferredColors: [] });

      expect(prisma.brand.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { preferredColors: [] } }),
      );
    });
  });

  describe('faixa de preço pesquisada', () => {
    it('lança BadRequestException ao criar com mínimo maior que o máximo', async () => {
      await expect(
        service.createBrand(userId, {
          name: 'Elegoo',
          status: 'RESEARCHED',
          researchedMinPricePerKg: 150,
          researchedMaxPricePerKg: 90,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.brand.create).not.toHaveBeenCalled();
    });

    it('compara com o valor salvo quando o PATCH traz só um dos lados', async () => {
      prisma.brand.findFirst.mockResolvedValue({
        ...brand,
        researchedMinPricePerKg: 90,
        researchedMaxPricePerKg: 120,
      });

      await expect(
        service.updateBrand(brandId, userId, { researchedMinPricePerKg: 130 }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.brand.update).not.toHaveBeenCalled();
    });

    it('aceita limpar a faixa com null', async () => {
      prisma.brand.findFirst.mockResolvedValue({
        ...brand,
        researchedMinPricePerKg: 90,
        researchedMaxPricePerKg: 120,
      });
      prisma.brand.update.mockResolvedValue(brand);

      await service.updateBrand(brandId, userId, {
        status: 'PURCHASED',
        researchedMinPricePerKg: null,
        researchedMaxPricePerKg: null,
      });

      expect(prisma.brand.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            status: 'PURCHASED',
            researchedMinPricePerKg: null,
            researchedMaxPricePerKg: null,
          },
        }),
      );
    });
  });

  describe('deleteBrand', () => {
    it('lança NotFoundException se a marca não for do usuário', async () => {
      prisma.brand.findFirst.mockResolvedValue(null);

      await expect(service.deleteBrand(brandId, userId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.brand.delete).not.toHaveBeenCalled();
    });

    it('exclui a marca', async () => {
      prisma.brand.findFirst.mockResolvedValue(brand);

      const result = await service.deleteBrand(brandId, userId);

      expect(prisma.brand.delete).toHaveBeenCalledWith({
        where: { id: brandId },
      });
      expect(result).toEqual({ message: 'Marca excluída com sucesso' });
    });
  });

  describe('notas', () => {
    it('adiciona nota à marca do usuário', async () => {
      prisma.brand.findFirst.mockResolvedValue(brand);
      prisma.brandNote.create.mockResolvedValue({ id: noteId });

      await service.addNote(brandId, userId, {
        content: ' Problema com o PLA rosa. ',
      });

      expect(prisma.brandNote.create).toHaveBeenCalledWith({
        data: { content: 'Problema com o PLA rosa.', brandId },
      });
    });

    it('lança NotFoundException ao editar nota de outro usuário', async () => {
      prisma.brandNote.findFirst.mockResolvedValue(null);

      await expect(
        service.updateNote(brandId, noteId, userId, { content: 'x' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.brandNote.findFirst).toHaveBeenCalledWith({
        where: { id: noteId, brandId, brand: { userId } },
      });
      expect(prisma.brandNote.update).not.toHaveBeenCalled();
    });

    it('exclui a nota', async () => {
      prisma.brandNote.findFirst.mockResolvedValue({ id: noteId });

      await service.deleteNote(brandId, noteId, userId);

      expect(prisma.brandNote.delete).toHaveBeenCalledWith({
        where: { id: noteId },
      });
    });
  });
});
