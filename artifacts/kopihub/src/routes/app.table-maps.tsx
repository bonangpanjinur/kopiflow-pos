import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useCurrentShop } from "@/lib/use-shop";
import { useCurrentOutlet } from "@/lib/use-outlet";
import {
  useTableMaps,
  useCreateTableMap,
  useUpdateTableMap,
  useDeleteTableMap,
  useTables,
} from "@/hooks/use-tables";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Edit2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/table-maps")({
  component: TableMapsPage,
});

interface TableMapFormData {
  name: string;
}

function TableMapsPage() {
  const { shop } = useCurrentShop();
  const { outlet } = useCurrentOutlet();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMapId, setEditingMapId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TableMapFormData>({
    name: "",
  });

  const { data: tableMaps, isLoading } = useTableMaps(outlet?.id || "");
  const { data: tables } = useTables(outlet?.id || "");
  const createTableMap = useCreateTableMap();
  const updateTableMap = useUpdateTableMap();
  const deleteTableMap = useDeleteTableMap();

  if (!shop || !outlet) {
    return <div className="p-6">Memuat data...</div>;
  }

  const handleCreateTableMap = async () => {
    if (!formData.name.trim()) {
      toast.error("Nama denah tidak boleh kosong");
      return;
    }

    if (editingMapId) {
      updateTableMap.mutate(
        {
          mapId: editingMapId,
          outletId: outlet.id,
          updates: { name: formData.name },
        },
        {
          onSuccess: () => {
            setFormData({ name: "" });
            setEditingMapId(null);
            setIsDialogOpen(false);
          },
        }
      );
    } else {
      createTableMap.mutate(
        {
          outletId: outlet.id,
          shopId: shop.id,
          name: formData.name,
          layout_data: {},
        },
        {
          onSuccess: () => {
            setFormData({ name: "" });
            setIsDialogOpen(false);
          },
        }
      );
    }
  };

  const handleEditTableMap = (map: any) => {
    setEditingMapId(map.id);
    setFormData({ name: map.name });
    setIsDialogOpen(true);
  };

  const handleDeleteTableMap = (mapId: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus denah ini?")) {
      deleteTableMap.mutate({
        mapId,
        outletId: outlet.id,
      });
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingMapId(null);
    setFormData({ name: "" });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Denah Meja</h1>
          <p className="text-gray-600 mt-1">
            Buat dan kelola denah meja untuk outlet Anda
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Buat Denah
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingMapId ? "Edit Denah Meja" : "Buat Denah Meja Baru"}
              </DialogTitle>
              <DialogDescription>
                {editingMapId
                  ? "Ubah nama denah meja Anda"
                  : "Buat denah meja baru untuk outlet ini"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nama Denah</Label>
                <Input
                  id="name"
                  placeholder="Misal: Lantai 1, Area Outdoor"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <Button
                onClick={handleCreateTableMap}
                disabled={createTableMap.isPending || updateTableMap.isPending}
                className="w-full"
              >
                {(createTableMap.isPending || updateTableMap.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingMapId ? "Simpan Perubahan" : "Buat Denah"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : tableMaps && tableMaps.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tableMaps.map((map) => {
            const mapTableCount = tables?.filter(
              (t) => t.outlet_id === outlet.id
            ).length || 0;

            return (
              <Card
                key={map.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{map.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {mapTableCount} meja
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditTableMap(map)}
                      >
                        <Edit2 className="w-4 h-4 text-blue-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTableMap(map.id)}
                        disabled={deleteTableMap.isPending}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-gray-100 rounded-lg h-40 flex items-center justify-center">
                    <p className="text-gray-500 text-sm">
                      Editor denah akan segera hadir
                    </p>
                  </div>
                  <Button variant="outline" className="w-full">
                    Edit Denah
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center h-64">
            <p className="text-gray-500 text-center mb-4">
              Belum ada denah. Mulai dengan membuat denah pertama Anda.
            </p>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Buat Denah Pertama
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Buat Denah Meja Baru</DialogTitle>
                  <DialogDescription>
                    Buat denah meja baru untuk outlet ini
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nama Denah</Label>
                    <Input
                      id="name"
                      placeholder="Misal: Lantai 1, Area Outdoor"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>
                  <Button
                    onClick={handleCreateTableMap}
                    disabled={createTableMap.isPending}
                    className="w-full"
                  >
                    {createTableMap.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Buat Denah
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
