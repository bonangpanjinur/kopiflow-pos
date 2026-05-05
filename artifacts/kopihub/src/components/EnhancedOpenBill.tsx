import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Plus, Trash2, Loader2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface EnhancedOpenBillProps {
  outletId: string;
  shopId: string;
  onBillSelected?: (billId: string) => void;
}

interface OpenBill {
  id: string;
  label: string;
  table_id: string | null;
  items: any[];
  created_at: string;
  created_by: string;
}

interface Table {
  id: string;
  name: string;
  capacity: number;
  status: string;
}

export function EnhancedOpenBill({
  outletId,
  shopId,
  onBillSelected,
}: EnhancedOpenBillProps) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    label: "",
    tableId: "",
  });

  // Fetch open bills
  const { data: openBills, isLoading: billsLoading } = useQuery({
    queryKey: ["open-bills", outletId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("open_bills")
        .select("*")
        .eq("outlet_id", outletId);

      if (error) throw error;
      return data as OpenBill[];
    },
  });

  // Fetch tables
  const { data: tables } = useQuery({
    queryKey: ["tables", outletId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tables")
        .select("*")
        .eq("outlet_id", outletId);

      if (error) throw error;
      return data as Table[];
    },
  });

  // Create open bill mutation
  const createBillMutation = useMutation({
    mutationFn: async (variables: {
      label: string;
      tableId?: string;
    }) => {
      const { data, error } = await supabase
        .from("open_bills")
        .insert([
          {
            shop_id: shopId,
            outlet_id: outletId,
            label: variables.label,
            table_id: variables.tableId || null,
            items: [],
            created_by: (await supabase.auth.getUser()).data.user?.id || "",
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["open-bills", outletId] });
      toast.success("Tagihan terbuka berhasil dibuat");
      setFormData({ label: "", tableId: "" });
      setIsDialogOpen(false);
      onBillSelected?.(data.id);
    },
    onError: (error) => {
      toast.error(`Gagal membuat tagihan: ${error.message}`);
    },
  });

  // Delete open bill mutation
  const deleteBillMutation = useMutation({
    mutationFn: async (billId: string) => {
      const { error } = await supabase
        .from("open_bills")
        .delete()
        .eq("id", billId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["open-bills", outletId] });
      toast.success("Tagihan berhasil dihapus");
    },
    onError: (error) => {
      toast.error(`Gagal menghapus tagihan: ${error.message}`);
    },
  });

  const handleCreateBill = () => {
    if (!formData.label.trim()) {
      toast.error("Label tagihan tidak boleh kosong");
      return;
    }

    createBillMutation.mutate({
      label: formData.label,
      tableId: formData.tableId || undefined,
    });
  };

  const handleDeleteBill = (billId: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus tagihan ini?")) {
      deleteBillMutation.mutate(billId);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Tagihan Terbuka</h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Buat Tagihan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buat Tagihan Terbuka</DialogTitle>
              <DialogDescription>
                Buat tagihan baru untuk dine-in atau pesanan khusus
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="label">Label Tagihan</Label>
                <Input
                  id="label"
                  placeholder="Misal: Meja 5, Pesanan Khusus"
                  value={formData.label}
                  onChange={(e) =>
                    setFormData({ ...formData, label: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="table">Pilih Meja (Opsional)</Label>
                <Select
                  value={formData.tableId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, tableId: value })
                  }
                >
                  <SelectTrigger id="table">
                    <SelectValue placeholder="Pilih meja..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tables?.map((table) => (
                      <SelectItem key={table.id} value={table.id}>
                        {table.name} ({table.capacity} orang)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleCreateBill}
                disabled={createBillMutation.isPending}
                className="w-full"
              >
                {createBillMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Buat Tagihan
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {billsLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : openBills && openBills.length > 0 ? (
        <div className="space-y-2">
          {openBills.map((bill) => {
            const tableInfo = bill.table_id
              ? tables?.find((t) => t.id === bill.table_id)
              : null;

            return (
              <Card
                key={bill.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onBillSelected?.(bill.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{bill.label}</h4>
                      {tableInfo && (
                        <p className="text-sm text-gray-600">
                          Meja: {tableInfo.name}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {bill.items?.length || 0} item
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBill(bill.id);
                        }}
                        disabled={deleteBillMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-center h-32">
            <p className="text-gray-500 text-sm">Tidak ada tagihan terbuka</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
