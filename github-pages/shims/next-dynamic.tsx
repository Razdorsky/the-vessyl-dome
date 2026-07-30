import {
  lazy,
  Suspense,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

type DynamicModule<Props extends object> =
  | ComponentType<Props>
  | { default: ComponentType<Props> };

type DynamicOptions = {
  loading?: () => ReactNode;
  ssr?: boolean;
};

export default function dynamic<Props extends object>(
  loader: () => Promise<DynamicModule<Props>>,
  options: DynamicOptions = {},
) {
  const LazyComponent = lazy(async () => {
    const loaded = await loader();
    return typeof loaded === "object" && "default" in loaded
      ? loaded
      : { default: loaded };
  });

  return function DynamicComponent(props: Props) {
    const [mounted, setMounted] = useState(options.ssr !== false);

    useEffect(() => {
      setMounted(true);
    }, []);

    if (!mounted) return options.loading?.() ?? null;

    return (
      <Suspense fallback={options.loading?.() ?? null}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}
