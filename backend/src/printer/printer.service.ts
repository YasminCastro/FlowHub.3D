import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrinterDto } from './dto/printer.js';
import { Prisma } from '../generated/prisma/browser.js';

@Injectable()
export class PrinterService {
  constructor(private prisma: PrismaService) {}

  // Toda leitura ou alteração por id passa por aqui: a impressora precisa ser
  // do usuário do token. De outro usuário responde 404, sem revelar que existe.
  private async findOwnedPrinter(printerId: string, userId: string) {
    const printer = await this.prisma.printer.findFirst({
      where: { id: printerId, userId },
      omit: { userId: true },
    });

    if (!printer) {
      throw new NotFoundException('Impressora não encontrada.');
    }

    return printer;
  }

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

  async getPrinterById(printerId: string, userId: string) {
    return this.findOwnedPrinter(printerId, userId);
  }

  async updatePrinter(
    printerId: string,
    userId: string,
    printerData: Prisma.PrinterUpdateInput,
  ) {
    await this.findOwnedPrinter(printerId, userId);

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

  async deletePrinter(printerId: string, userId: string) {
    await this.findOwnedPrinter(printerId, userId);

    await this.prisma.printer.delete({
      where: {
        id: printerId,
      },
    });

    return { message: 'Impressora deletada com sucesso' };
  }
}
