import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CostSettingsDto } from './dto/cost-settings.js';

// Valem enquanto o usuário não salva a própria configuração.
export const DEFAULT_COST_SETTINGS = {
  energyCostPerKwh: 0.92,
  currency: 'BRL',
  laborCostPerHour: 35,
  prepMinutesPerPiece: 15,
  defaultMarginPercent: 60,
  packagingCost: 1.2,
  failureReservePercent: 7,
  otherFixedCost: 0,
};

const settingsSelect = {
  energyCostPerKwh: true,
  currency: true,
  laborCostPerHour: true,
  prepMinutesPerPiece: true,
  defaultMarginPercent: true,
  packagingCost: true,
  failureReservePercent: true,
  otherFixedCost: true,
};

@Injectable()
export class CostSettingsService {
  constructor(private prisma: PrismaService) {}

  async findCostSettings(userId: string) {
    const settings = await this.prisma.costSettings.findUnique({
      where: { userId },
      select: settingsSelect,
    });

    return settings ?? DEFAULT_COST_SETTINGS;
  }

  async updateCostSettings(userId: string, dto: CostSettingsDto) {
    const { printerTariffs = [], ...data } = dto;

    const ownTariffs = new Map(
      printerTariffs.map((t) => [t.printerId, t.energyCostPerKwh]),
    );
    if (ownTariffs.size !== printerTariffs.length) {
      throw new BadRequestException('Impressora repetida na lista de tarifas.');
    }

    const printerIds = [...ownTariffs.keys()];
    if (printerIds.length) {
      const owned = await this.prisma.printer.count({
        where: { id: { in: printerIds }, userId },
      });
      if (owned !== printerIds.length) {
        throw new BadRequestException('Impressora não encontrada.');
      }
    }

    // A tarifa fica gravada em cada impressora: quem herda acompanha a
    // global, quem tem tarifa própria grava o valor dela.
    const [settings] = await this.prisma.$transaction([
      this.prisma.costSettings.upsert({
        where: { userId },
        create: { ...data, userId },
        update: data,
        select: settingsSelect,
      }),
      this.prisma.printer.updateMany({
        where: { userId, id: { notIn: printerIds } },
        data: { energyCostPerKwh: data.energyCostPerKwh },
      }),
      ...printerIds.map((id) =>
        this.prisma.printer.update({
          where: { id },
          data: { energyCostPerKwh: ownTariffs.get(id) },
        }),
      ),
    ]);

    return {
      message: 'Custos atualizados com sucesso',
      settings,
    };
  }
}
