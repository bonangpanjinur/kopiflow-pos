import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useTables(outletId: string) {
  return useQuery({
    queryKey: ["tables", outletId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tables")
        .select("*")
        .eq("outlet_id", outletId);

      if (error) throw error;
      return data;
    },
    enabled: !!outletId,
  });
}

export function useTable(tableId: string) {
  return useQuery({
    queryKey: ["table", tableId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tables")
        .select("*")
        .eq("id", tableId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!tableId,
  });
}

export function useCreateTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      variables: {
        outletId: string;
        shopId: string;
        name: string;
        capacity: number;
        position_x?: number;
        position_y?: number;
        width?: number;
        height?: number;
        shape?: "rectangle" | "circle";
      }
    ) => {
      const { outletId, shopId, ...tableData } = variables;

      const { data, error } = await supabase
        .from("tables")
        .insert([
          {
            shop_id: shopId,
            outlet_id: outletId,
            ...tableData,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tables", data.outlet_id] });
      toast.success("Meja berhasil ditambahkan");
    },
    onError: (error) => {
      toast.error(`Gagal menambahkan meja: ${error.message}`);
    },
  });
}

export function useUpdateTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      variables: {
        tableId: string;
        outletId: string;
        updates: Record<string, any>;
      }
    ) => {
      const { tableId, outletId, updates } = variables;

      const { data, error } = await supabase
        .from("tables")
        .update(updates)
        .eq("id", tableId)
        .select()
        .single();

      if (error) throw error;
      return { data, outletId };
    },
    onSuccess: ({ data, outletId }) => {
      queryClient.invalidateQueries({ queryKey: ["tables", outletId] });
      queryClient.invalidateQueries({ queryKey: ["table", data.id] });
      toast.success("Meja berhasil diperbarui");
    },
    onError: (error) => {
      toast.error(`Gagal memperbarui meja: ${error.message}`);
    },
  });
}

export function useDeleteTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { tableId: string; outletId: string }) => {
      const { tableId, outletId } = variables;

      const { error } = await supabase
        .from("tables")
        .delete()
        .eq("id", tableId);

      if (error) throw error;
      return outletId;
    },
    onSuccess: (outletId) => {
      queryClient.invalidateQueries({ queryKey: ["tables", outletId] });
      toast.success("Meja berhasil dihapus");
    },
    onError: (error) => {
      toast.error(`Gagal menghapus meja: ${error.message}`);
    },
  });
}

export function useUpdateTableStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      variables: {
        tableId: string;
        outletId: string;
        status: "available" | "occupied" | "dirty" | "reserved";
      }
    ) => {
      const { tableId, outletId, status } = variables;

      const { data, error } = await supabase
        .from("tables")
        .update({ status })
        .eq("id", tableId)
        .select()
        .single();

      if (error) throw error;
      return { data, outletId };
    },
    onSuccess: ({ data, outletId }) => {
      queryClient.invalidateQueries({ queryKey: ["tables", outletId] });
      queryClient.invalidateQueries({ queryKey: ["table", data.id] });
    },
    onError: (error) => {
      toast.error(`Gagal memperbarui status meja: ${error.message}`);
    },
  });
}

export function useTableMaps(outletId: string) {
  return useQuery({
    queryKey: ["table-maps", outletId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("table_maps")
        .select("*")
        .eq("outlet_id", outletId);

      if (error) throw error;
      return data;
    },
    enabled: !!outletId,
  });
}

export function useTableMap(mapId: string) {
  return useQuery({
    queryKey: ["table-map", mapId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("table_maps")
        .select("*")
        .eq("id", mapId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!mapId,
  });
}

export function useCreateTableMap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      variables: {
        outletId: string;
        shopId: string;
        name: string;
        layout_data?: Record<string, any>;
      }
    ) => {
      const { outletId, shopId, name, layout_data } = variables;

      const { data, error } = await supabase
        .from("table_maps")
        .insert([
          {
            shop_id: shopId,
            outlet_id: outletId,
            name,
            layout_data: layout_data || {},
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["table-maps", data.outlet_id] });
      toast.success("Denah meja berhasil dibuat");
    },
    onError: (error) => {
      toast.error(`Gagal membuat denah meja: ${error.message}`);
    },
  });
}

export function useUpdateTableMap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      variables: {
        mapId: string;
        outletId: string;
        updates: Record<string, any>;
      }
    ) => {
      const { mapId, outletId, updates } = variables;

      const { data, error } = await supabase
        .from("table_maps")
        .update(updates)
        .eq("id", mapId)
        .select()
        .single();

      if (error) throw error;
      return { data, outletId };
    },
    onSuccess: ({ data, outletId }) => {
      queryClient.invalidateQueries({ queryKey: ["table-maps", outletId] });
      queryClient.invalidateQueries({ queryKey: ["table-map", data.id] });
      toast.success("Denah meja berhasil diperbarui");
    },
    onError: (error) => {
      toast.error(`Gagal memperbarui denah meja: ${error.message}`);
    },
  });
}

export function useDeleteTableMap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { mapId: string; outletId: string }) => {
      const { mapId, outletId } = variables;

      const { error } = await supabase
        .from("table_maps")
        .delete()
        .eq("id", mapId);

      if (error) throw error;
      return outletId;
    },
    onSuccess: (outletId) => {
      queryClient.invalidateQueries({ queryKey: ["table-maps", outletId] });
      toast.success("Denah meja berhasil dihapus");
    },
    onError: (error) => {
      toast.error(`Gagal menghapus denah meja: ${error.message}`);
    },
  });
}
