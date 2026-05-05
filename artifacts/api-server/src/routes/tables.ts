import { Router, type IRouter, type Request, type Response } from "express";
import { supabaseAdmin } from "@/lib/supabase-admin";

const router: IRouter = Router();

// Get all tables for an outlet
router.get("/outlets/:outletId/tables", async (req: Request, res: Response) => {
  try {
    const { outletId } = req.params;
    const { data, error } = await supabaseAdmin
      .from("tables")
      .select("*")
      .eq("outlet_id", outletId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get a single table
router.get("/tables/:tableId", async (req: Request, res: Response) => {
  try {
    const { tableId } = req.params;
    const { data, error } = await supabaseAdmin
      .from("tables")
      .select("*")
      .eq("id", tableId)
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create a new table
router.post("/outlets/:outletId/tables", async (req: Request, res: Response) => {
  try {
    const { outletId } = req.params;
    const {
      shop_id,
      name,
      capacity,
      position_x,
      position_y,
      width,
      height,
      shape,
    } = req.body;

    const { data, error } = await supabaseAdmin
      .from("tables")
      .insert([
        {
          shop_id,
          outlet_id: outletId,
          name,
          capacity,
          position_x,
          position_y,
          width,
          height,
          shape,
        },
      ])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update a table
router.put("/tables/:tableId", async (req: Request, res: Response) => {
  try {
    const { tableId } = req.params;
    const updates = req.body;

    const { data, error } = await supabaseAdmin
      .from("tables")
      .update(updates)
      .eq("id", tableId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete a table
router.delete("/tables/:tableId", async (req: Request, res: Response) => {
  try {
    const { tableId } = req.params;

    const { error } = await supabaseAdmin
      .from("tables")
      .delete()
      .eq("id", tableId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update table status
router.patch("/tables/:tableId/status", async (req: Request, res: Response) => {
  try {
    const { tableId } = req.params;
    const { status } = req.body;

    const validStatuses = ["available", "occupied", "dirty", "reserved"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const { data, error } = await supabaseAdmin
      .from("tables")
      .update({ status })
      .eq("id", tableId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all table maps for an outlet
router.get("/outlets/:outletId/table-maps", async (req: Request, res: Response) => {
  try {
    const { outletId } = req.params;
    const { data, error } = await supabaseAdmin
      .from("table_maps")
      .select("*")
      .eq("outlet_id", outletId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get a single table map
router.get("/table-maps/:mapId", async (req: Request, res: Response) => {
  try {
    const { mapId } = req.params;
    const { data, error } = await supabaseAdmin
      .from("table_maps")
      .select("*")
      .eq("id", mapId)
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create a new table map
router.post("/outlets/:outletId/table-maps", async (req: Request, res: Response) => {
  try {
    const { outletId } = req.params;
    const { shop_id, name, layout_data } = req.body;

    const { data, error } = await supabaseAdmin
      .from("table_maps")
      .insert([
        {
          shop_id,
          outlet_id: outletId,
          name,
          layout_data: layout_data || {},
        },
      ])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update a table map
router.put("/table-maps/:mapId", async (req: Request, res: Response) => {
  try {
    const { mapId } = req.params;
    const updates = req.body;

    const { data, error } = await supabaseAdmin
      .from("table_maps")
      .update(updates)
      .eq("id", mapId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete a table map
router.delete("/table-maps/:mapId", async (req: Request, res: Response) => {
  try {
    const { mapId } = req.params;

    const { error } = await supabaseAdmin
      .from("table_maps")
      .delete()
      .eq("id", mapId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get table status overview for an outlet
router.get("/outlets/:outletId/table-status", async (req: Request, res: Response) => {
  try {
    const { outletId } = req.params;

    const { data, error } = await supabaseAdmin
      .from("tables")
      .select("id, name, status, capacity")
      .eq("outlet_id", outletId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const summary = {
      total: data.length,
      available: data.filter((t) => t.status === "available").length,
      occupied: data.filter((t) => t.status === "occupied").length,
      dirty: data.filter((t) => t.status === "dirty").length,
      reserved: data.filter((t) => t.status === "reserved").length,
      tables: data,
    };

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
