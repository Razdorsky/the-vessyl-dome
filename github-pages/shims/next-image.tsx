import {
  forwardRef,
  type CSSProperties,
  type ImgHTMLAttributes,
} from "react";

type StaticImageData = {
  src: string;
};

type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  fill?: boolean;
  priority?: boolean;
  src: string | StaticImageData;
  unoptimized?: boolean;
};

const fillStyles: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
};

const Image = forwardRef<HTMLImageElement, ImageProps>(function Image(
  {
    fill = false,
    height,
    loading,
    priority = false,
    src,
    style,
    unoptimized,
    width,
    ...props
  },
  ref,
) {
  void unoptimized;

  return (
    // This compatibility shim preserves the existing authored image markup in
    // the static Pages build; all sources are local, pre-sized project assets.
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img
      {...props}
      ref={ref}
      src={typeof src === "string" ? src : src.src}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      loading={priority ? "eager" : loading}
      fetchPriority={priority ? "high" : props.fetchPriority}
      style={fill ? { ...fillStyles, ...style } : style}
    />
  );
});

export default Image;
