import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Light-only toaster: the app has a single fixed theme, so no next-themes. */
const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="light"
    className="toaster group"
    style={
      {
        "--normal-bg": "#fff",
        "--normal-text": "#1a1a1a",
        "--normal-border": "#e0d8cc",
      } as React.CSSProperties
    }
    {...props}
  />
);

export { Toaster };
