import type { ReactNode } from "react";
import { AnimatedText } from "../animated-text/AnimatedText";
import styles from "./PagePanel.module.css";

type PagePanelProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
};

export function PagePanel({ title, subtitle, children }: PagePanelProps) {
  return (
    <section className={styles.panel}>
      <AnimatedText as="h1" className={styles.heading}>{title}</AnimatedText>
      {subtitle && <AnimatedText as="p" className={styles.sub}>{subtitle}</AnimatedText>}
      {children && <div className={styles.body}>{children}</div>}
    </section>
  );
}
