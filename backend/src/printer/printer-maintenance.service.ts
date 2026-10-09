import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  PrinterMaintenanceDto,
  UpdatePrinterMaintenanceDto,
} from './dto/printer-maintenance.js';
import { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class PrinterMaintenanceService {
  constructor(private prisma: PrismaService) {}

  private async findOwnedPrinter(printerId: string, userId: string) {
    const printer = await this.prisma.printer.findFirst({
      where: { id: printerId, userId },
    });

    if (!printer) {
      throw new NotFoundException('Impressora não encontrada.');
    }

    return printer;
  }

  private async findOwnedMaintenance(
    printerId: string,
    maintenanceId: string,
    userId: string,
  ) {
    const maintenance = await this.prisma.printerMaintenance.findFirst({
      where: { id: maintenanceId, printerId, printer: { userId } },
      include: { printer: true },
    });

    if (!maintenance) {
      throw new NotFoundException('Manutenção não encontrada.');
    }

    return maintenance;
  }

  // Depois de editar ou excluir, a última manutenção da impressora passa a ser
  // a mais recente do histórico. Sem histórico, só limpa a data se ela tinha
  // vindo da manutenção alterada — uma data informada à mão é mantida.
  private async syncLastMaintenanceDate(
    printerId: string,
    printerLastDate: Date | null,
    changedDate: Date,
  ) {
    const latest = await this.prisma.printerMaintenance.findFirst({
      where: { printerId },
      orderBy: { date: 'desc' },
    });

    let lastMaintenanceDate: Date | null | undefined;
    if (latest) {
      lastMaintenanceDate = latest.date;
    } else if (printerLastDate?.getTime() === changedDate.getTime()) {
      lastMaintenanceDate = null;
    }

    if (lastMaintenanceDate === undefined) return;

    await this.prisma.printer.update({
      where: { id: printerId },
      data: { lastMaintenanceDate },
    });
  }

  async registerMaintenance(
    printerId: string,
    userId: string,
    data: PrinterMaintenanceDto,
  ) {
    const printer = await this.findOwnedPrinter(printerId, userId);

    // Só avança a última manutenção: registrar uma antiga não pode voltar a data.
    const printerUpdate: Prisma.PrinterUpdateInput = {};
    if (
      !printer.lastMaintenanceDate ||
      data.date > printer.lastMaintenanceDate
    ) {
      printerUpdate.lastMaintenanceDate = data.date;
    }
    // Troca de bico atualiza a ficha técnica com o bico novo.
    if (data.type === 'NOZZLE_CHANGE' && data.nozzleInstalled) {
      printerUpdate.nozzle = data.nozzleInstalled;
    }

    const [maintenance] = await this.prisma.$transaction([
      this.prisma.printerMaintenance.create({
        data: { ...data, printerId },
      }),
      this.prisma.printer.update({
        where: { id: printerId },
        data: printerUpdate,
      }),
    ]);

    return {
      message: 'Manutenção registrada com sucesso',
      data: maintenance,
    };
  }

  async getMaintenances(printerId: string, userId: string) {
    await this.findOwnedPrinter(printerId, userId);

    const maintenances = await this.prisma.printerMaintenance.findMany({
      where: { printerId },
      orderBy: { date: 'desc' },
    });

    const totalCost = maintenances.reduce(
      (total, maintenance) => total + (maintenance.cost ?? 0),
      0,
    );

    return { maintenances, totalCost };
  }

  async getMaintenanceById(
    printerId: string,
    maintenanceId: string,
    userId: string,
  ) {
    const maintenance = await this.prisma.printerMaintenance.findFirst({
      where: { id: maintenanceId, printerId, printer: { userId } },
    });

    if (!maintenance) {
      throw new NotFoundException('Manutenção não encontrada.');
    }

    return maintenance;
  }

  async updateMaintenance(
    printerId: string,
    maintenanceId: string,
    userId: string,
    data: UpdatePrinterMaintenanceDto,
  ) {
    const { printer, ...current } = await this.findOwnedMaintenance(
      printerId,
      maintenanceId,
      userId,
    );

    const updatedMaintenance = await this.prisma.printerMaintenance.update({
      where: { id: maintenanceId },
      data,
    });

    await this.syncLastMaintenanceDate(
      printerId,
      printer.lastMaintenanceDate,
      current.date,
    );

    // Corrigir o bico só mexe na ficha se esta for a troca de bico mais recente.
    if (
      updatedMaintenance.type === 'NOZZLE_CHANGE' &&
      updatedMaintenance.nozzleInstalled
    ) {
      const latestNozzleChange = await this.prisma.printerMaintenance.findFirst(
        {
          where: { printerId, type: 'NOZZLE_CHANGE' },
          orderBy: { date: 'desc' },
        },
      );
      if (latestNozzleChange?.id === maintenanceId) {
        await this.prisma.printer.update({
          where: { id: printerId },
          data: { nozzle: updatedMaintenance.nozzleInstalled },
        });
      }
    }

    return {
      message: 'Manutenção atualizada com sucesso',
      data: updatedMaintenance,
    };
  }

  async deleteMaintenance(
    printerId: string,
    maintenanceId: string,
    userId: string,
  ) {
    const { printer, ...maintenance } = await this.findOwnedMaintenance(
      printerId,
      maintenanceId,
      userId,
    );

    await this.prisma.printerMaintenance.delete({
      where: { id: maintenanceId },
    });

    await this.syncLastMaintenanceDate(
      printerId,
      printer.lastMaintenanceDate,
      maintenance.date,
    );

    return { message: 'Manutenção excluída com sucesso' };
  }
}
