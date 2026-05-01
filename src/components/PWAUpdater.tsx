import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";

export function PWAUpdater() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needUpdate: [needUpdate, setNeedUpdate],
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
    if (needUpdate) {
      toast("Versi baru tersedia!", {
        description: "Klik tombol untuk memperbarui aplikasi.",
        action: {
          label: "Perbarui",
          onClick: () => updateServiceWorker(true),
        },
        duration: Infinity,
      });
    }
  }, [needUpdate, updateServiceWorker]);

  return null;
}
