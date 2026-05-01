import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

// VAPID Public Key should ideally come from env
const VAPID_PUBLIC_KEY = "BEl62OnarIdSTXCc8Rhdu7s7D_969_I-Y2S_f3n-8_Y2S_f3n-8_Y2S_f3n-8_Y2S_f3n-8"; 

export function PushNotificationManager() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      checkSubscription();
    }
  }, []);

  async function checkSubscription() {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    setSubscription(sub);
  }

  async function subscribeToPush() {
    if (!user) return;
    
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: VAPID_PUBLIC_KEY,
      });

      // Save to Supabase (assuming table exists or using a generic approach)
      const { error } = await supabase.from("push_subscriptions" as any).upsert({
        user_id: user.id,
        subscription: sub.toJSON() as any,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      setSubscription(sub);
      toast.success("Notifikasi diaktifkan!");
    } catch (err) {
      console.error("Failed to subscribe to push", err);
      toast.error("Gagal mengaktifkan notifikasi.");
    }
  }

  // We don't render anything, this just manages the logic
  // or we could render a toggle in a settings page later.
  return null;
}
