import { useTheme } from "next-themes";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  LoaderCircle,
  XCircle,
} from "lucide-react";
import { Toaster as Sonner, toast } from "sonner";
import "sonner/dist/styles.css";
import { cn } from "@/lib/utils";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const toastIcons = {
  success: <CheckCircle2 aria-hidden="true" />,
  info: <Info aria-hidden="true" />,
  warning: <AlertTriangle aria-hidden="true" />,
  error: <XCircle aria-hidden="true" />,
  loading: <LoaderCircle aria-hidden="true" />,
};

const Toaster = ({ className, icons, toastOptions, ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const classNames = toastOptions?.classNames;

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="bottom-center"
      expand
      gap={8}
      visibleToasts={4}
      swipeDirections={["left", "right"]}
      offset={{ bottom: 104 }}
      mobileOffset={{
        bottom: "calc(104px + env(safe-area-inset-bottom, 0px))",
        left: 16,
        right: 16,
      }}
      pauseWhenPageIsHidden
      containerAriaLabel="通知"
      {...props}
      className={cn("toaster app-toaster group", className)}
      icons={{ ...toastIcons, ...icons }}
      toastOptions={{
        ...toastOptions,
        classNames: {
          ...classNames,
          toast: cn(
            "group toast app-toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
            classNames?.toast,
          ),
          content: cn("app-toast-content", classNames?.content),
          icon: cn("app-toast-icon", classNames?.icon),
          description: cn("group-[.toast]:text-muted-foreground", classNames?.description),
          actionButton: cn(
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
            classNames?.actionButton,
          ),
          cancelButton: cn(
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
            classNames?.cancelButton,
          ),
        },
      }}
    />
  );
};

export { Toaster, toast };
