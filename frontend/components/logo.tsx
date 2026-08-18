import Image from "next/image";

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/flowhub3d.png"
        alt=""
        width={34}
        height={34}
        className="object-contain"
      />
      <div>
        <p className="font-heading text-base font-medium">FlowHub.3D</p>
        <p className="text-[11.5px] text-muted-foreground">Impressão 3D</p>
      </div>
    </div>
  );
}
