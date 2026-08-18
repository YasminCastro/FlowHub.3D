import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col gap-10 px-6 py-10 sm:px-11">
      <header className="flex items-center gap-3">
        <Image
          src="/flowhub3d-logo.png"
          alt="FlowHub 3D"
          width={36}
          height={36}
          className="rounded-md"
          priority
        />
        <div>
          <h1 className="text-lg font-medium">FlowHub 3D</h1>
          <p className="text-sm text-muted-foreground">
            Nocturne design system — style guide
          </p>
        </div>
      </header>

      <hr className="fade-rule" />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Buttons
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button>Continuar</Button>
          <Button variant="secondary">Visualizar</Button>
          <Button variant="ghost">Saiba mais</Button>
          <Button variant="secondary" disabled>
            Desativado
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Tags
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Accent · tinted</Badge>
          <Badge variant="outline">Accent · outlined</Badge>
          <Badge variant="secondary">Neutral</Badge>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <p className="text-[10px] font-medium tracking-[0.1em] text-brand uppercase">
              Filamento
            </p>
            <CardTitle>Marrom PLA</CardTitle>
            <CardDescription>1.75mm · 320g restantes</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="rolo">Nome do rolo</Label>
              <Input id="rolo" placeholder="ex: Marrom PLA #2" />
            </div>
            <Button variant="default" className="w-full">
              Registrar impressão
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Impressões recentes</CardTitle>
            <CardDescription>Últimos registros do diário</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Peça</TableHead>
                  <TableHead>Filamento</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Chaveiro de porco</TableCell>
                  <TableCell>Marrom PLA</TableCell>
                  <TableCell>
                    <Badge variant="outline">Concluída</Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Sardines Jewellery Box</TableCell>
                  <TableCell>Neutral PETG</TableCell>
                  <TableCell>
                    <Badge>Em progresso</Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
