import { Button } from "./Button";
import { Card } from "./Card";
import { CardBody } from "./CardBody";
import { CardHeader } from "./CardHeader";

export function Confirm({
  open,
  title,
  desc,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  desc?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <Card className="w-[520px] max-w-full">
        <CardHeader
          title={title}
          subtitle={desc}
          right={
            <Button kind="ghost" onClick={onCancel}>
              Cerrar
            </Button>
          }
        />
        <CardBody>
          <div className="flex justify-end gap-3">
            <Button kind="secondary" onClick={onCancel}>
              Cancelar
            </Button>
            <Button kind="danger" onClick={onConfirm}>
              Confirmar
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
