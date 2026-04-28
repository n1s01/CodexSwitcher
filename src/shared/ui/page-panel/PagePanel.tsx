import type { ReactNode } from "react";
import styles from "./PagePanel.module.css";

type PagePanelProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
};

export function PagePanel({ title, subtitle, children }: PagePanelProps) {
  return (
    <section className={styles.panel}>
      <h1 className={styles.heading}>{title}</h1>
      {subtitle && <p className={styles.sub}>{subtitle}</p>}
      {children && <div className={styles.body}>{children}</div>}
    </section>
  );
}
