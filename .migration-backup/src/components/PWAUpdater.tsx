import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";

function PWAUpdaterInner() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log("SW Registered: ", r);
    },
    onRegisterError(error) {
      console.log("SW registration error", error);
    },
  });

  useEffect(() => {
    if (offlineReady) {
      toast.success("Aplikasi siap digunakan secara offline!");
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    if (needRefresh) {
      toast("Versi baru tersedia!", {
        description: "Klik tombol untuk memperbarui aplikasi.",
        action: {
          label: "Perbarui",
          onClick: () => updateServiceWorker(true),
        },
        duration: Infinity,
      });
      setNeedRefresh(false);
    }
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
}

export function PWAUpdater() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <PWAUpdaterInner />;
}
