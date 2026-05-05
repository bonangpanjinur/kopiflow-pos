import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useCurrentShop } from "@/lib/use-shop";
import { useCurrentOutlet } from "@/lib/use-outlet";
import {
  useTables,
  useCreateTable,
  useUpdateTableStatus,
  useDeleteTable,
} from "@/hooks/use-tables";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export const Route = createFileRoute("/app/tables")({
  component: TablesPage,
});

type TableStatus = "available" | "occupied" | "dirty" | "reserved";

interface TableFormData {
  name: string;
  capacity: string;
  shape: "rectangle" | "circle";
}

function TablesPage() {
  const { shop } = useCurrentShop();
  const { outlet } = useCurrentOutlet();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<TableFormData>({
    name: "",
    capacity: "2",
    shape: "rectangle",
  });

  const { data: tables, isLoading } = useTables(outlet?.id || "");
  const createTable = useCreateTable();
  const updateTableStatus = useUpdateTableStatus();
  const deleteTable = useDeleteTable();

  if (!shop || !outlet) {
    return <div className="p-6">Memuat data...</div>;
  }

  const handleCreateTable = async () => {
    if (!formData.name.trim()) {
      toast.error("Nama meja tidak boleh kosong");
      return;
    }

    createTable.mutate(
      {
        outletId: outlet.id,
        shopId: shop.id,
        name: formData.name,
        capacity: parseInt(formData.capacity),
        shape: formData.shape,
        position_x: 0,
        position_y: 0,
        width: 1,
        height: 1,
      },
      {
        onSuccess: () => {
          setFormData({ name: "", capacity: "2", shape: "rectangle" });
          setIsDialogOpen(false);
        },
      }
    );
  };

  const handleStatusChange = (tableId: string, newStatus: TableStatus) => {
    updateTableStatus.mutate({
      tableId,
      outletId: outlet.id,
      status: newStatus,
    });
  };

  const handleDeleteTable = (tableId: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus meja ini?")) {
      deleteTable.mutate({
        tableId,
        outletId: outlet.id,
      });
    }
  };

  const getStatusColor = (status: TableStatus) => {
    switch (status) {
      case "available":
        return "bg-green-100 text-green-800";
      case "occupied":
        return "bg-blue-100 text-blue-800";
      case "dirty":
        return "bg-yellow-100 text-yellow-800";
      case "reserved":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: TableStatus) => {
    switch (status) {
      case "available":
        return "Tersedia";
      case "occupied":
        return "Terisi";
      case "dirty":
        return "Kotor";
      case "reserved":
        return "Dipesan";
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manajemen Meja</h1>
          <p className="text-gray-600 mt-1">
            Kelola meja dan denah outlet Anda
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Tambah Meja
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Meja Baru</DialogTitle>
              <DialogDescription>
                Buat meja baru untuk outlet ini
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nama Meja</Label>
                <Input
                  id="name"
                  placeholder="Misal: Meja 1, Bar Counter"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="capacity">Kapasitas</Label>
                <Input
                  id="capacity"
                  type="number"
                  min="1"
                  value={formData.capacity}
                  onChange={(e) =>
                    setFormData({ ...formData, capacity: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="shape">Bentuk Meja</Label>
                <Select
                  value={formData.shape}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      shape: value as "rectangle" | "circle",
                    })
                  }
                >
                  <SelectTrigger id="shape">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rectangle">Persegi Panjang</SelectItem>
                    <SelectItem value="circle">Lingkaran</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleCreateTable}
                disabled={createTable.isPending}
                className="w-full"
              >
                {createTable.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Buat Meja
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : tables && tables.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tables.map((table) => (
            <Card key={table.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{table.name}</CardTitle>
                    <CardDescription className="mt-1">
                      Kapasitas: {table.capacity} orang
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTable(table.id)}
                      disabled={deleteTable.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <Select
                    value={table.status}
                    onValueChange={(value) =>
                      handleStatusChange(table.id, value as TableStatus)
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Tersedia</SelectItem>
                      <SelectItem value="occupied">Terisi</SelectItem>
                      <SelectItem value="dirty">Kotor</SelectItem>
                      <SelectItem value="reserved">Dipesan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div
                  className={`px-3 py-1 rounded-full text-sm font-medium w-fit ${getStatusColor(
                    table.status
                  )}`}
                >
                  {getStatusLabel(table.status)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center h-64">
            <p className="text-gray-500 text-center mb-4">
              Belum ada meja. Mulai dengan membuat meja pertama Anda.
            </p>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Buat Meja Pertama
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tambah Meja Baru</DialogTitle>
                  <DialogDescription>
                    Buat meja baru untuk outlet ini
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nama Meja</Label>
                    <Input
                      id="name"
                      placeholder="Misal: Meja 1, Bar Counter"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="capacity">Kapasitas</Label>
                    <Input
                      id="capacity"
                      type="number"
                      min="1"
                      value={formData.capacity}
                      onChange={(e) =>
                        setFormData({ ...formData, capacity: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="shape">Bentuk Meja</Label>
                    <Select
                      value={formData.shape}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          shape: value as "rectangle" | "circle",
                        })
                      }
                    >
                      <SelectTrigger id="shape">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rectangle">Persegi Panjang</SelectItem>
                        <SelectItem value="circle">Lingkaran</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleCreateTable}
                    disabled={createTable.isPending}
                    className="w-full"
                  >
                    {createTable.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Buat Meja
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
