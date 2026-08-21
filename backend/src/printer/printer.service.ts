import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrinterDto } from './dto/printer.js';
import { Prisma } from '../generated/prisma/browser.js';

@Injectable()
export class PrinterService {
  constructor(private prisma: PrismaService) {}

  async createPrinter(printerData: PrinterDto & { userId: string }) {
    const printer = await this.prisma.printer.findUnique({
      where: {
        userId_name: {
          userId: printerData.userId,
          name: printerData.name,
        },
      },
    });

    if (printer) {
      throw new ConflictException('Essa impressora já existe.');
    }

    const categoryCreated = await this.prisma.printer.create({
      data: printerData,
    });

    return {
      message: 'Impressora criada com sucesso',
      data: categoryCreated,
    };
  }

  async getAllPrinters(userId: string) {
    const printers = await this.prisma.printer.findMany({
      where: {
        userId,
      },
      omit: {
        userId: true,
      },
    });
    return printers;
  }

  async getPrinterById(printerId: string) {
    const printer = await this.prisma.printer.findUnique({
      where: {
        id: printerId,
      },
      omit: {
        userId: true,
      },
    });

    return printer;
  }

  async updatePrinter(
    printerId: string,
    printerData: Prisma.PrinterUpdateInput,
  ) {
    const printer = await this.prisma.printer.findUnique({
      where: {
        id: printerId,
      },
    });

    if (!printer) {
      throw new ConflictException('Impressora não encontrada.');
    }
    const updatedPrinter = await this.prisma.printer.update({
      where: {
        id: printerId,
      },
      data: printerData,
      omit: {
        userId: true,
      },
    });

    return {
      message: 'Impressora atualizada com sucesso',
      printer: updatedPrinter,
    };
  }

  async deletePrinter(printerId: string) {
    const printer = await this.prisma.printer.findUnique({
      where: {
        id: printerId,
      },
    });

    if (!printer) {
      throw new ConflictException('Impressora não encontrada.');
    }
    await this.prisma.printer.delete({
      where: {
        id: printerId,
      },
    });

    return { message: 'Impressora deletada com sucesso' };
  }
}
