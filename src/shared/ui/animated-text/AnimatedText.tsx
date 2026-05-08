import type { ElementType, ReactNode } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import styles from "./AnimatedText.module.css";

type AnimatedTextProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
};

type Props<T extends ElementType> = AnimatedTextProps<T> &
  Omit<React.ComponentPropsWithoutRef<T>, keyof AnimatedTextProps<T>>;

export function AnimatedText<T extends ElementType = "span">({
  as,
  children,
  className,
  ...rest
}: Props<T>) {
  const { locale } = useI18n();
  const Component = (as ?? "span") as ElementType;

  return (
    <Component className={className} {...rest}>
      <span key={locale} className={styles.inner}>
        {children}
      </span>
    </Component>
  );
}
