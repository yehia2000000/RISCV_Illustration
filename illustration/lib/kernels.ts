export type KernelStatus = "ready" | "placeholder";

export type KernelPage = {
  href: string;
  label: string;
  children?: KernelPage[];
};

export type Kernel = {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  status: KernelStatus;
  summary: string;
  refSymbol?: string;
  pages: KernelPage[];
};

export const KERNELS: Kernel[] = [
  {
    id: "convolution",
    slug: "convolution",
    title: "2D Convolution",
    shortTitle: "Convolution",
    status: "ready",
    summary:
      "Same-size n×n box filter: average each neighborhood with BorderMode, integer divide by n².",
    refSymbol: "ref::BoxFilterNxN",
    pages: [
      { href: "/convolution", label: "Overview" },
      { href: "/convolution/walkthrough", label: "Scalar Walkthrough" },
      { href: "/convolution/vector", label: "Vector Walkthrough" },
    ],
  },
];

export function kernelById(id: string): Kernel {
  const kernel = KERNELS.find((item) => item.id === id);
  if (!kernel) {
    throw new Error(`Unknown kernel id: ${id}`);
  }
  return kernel;
}

export function isPageActive(href: string, pathname: string, exact: boolean): boolean {
  if (exact) {
    return pathname === href || pathname === `${href}/`;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isSectionActive(
  page: KernelPage,
  pathname: string,
  siblings: KernelPage[],
): boolean {
  const moreSpecific = siblings.filter(
    (other) => other.href !== page.href && other.href.startsWith(`${page.href}/`),
  );
  if (
    moreSpecific.some((other) => isPageActive(other.href, pathname, false))
  ) {
    return false;
  }
  return isPageActive(page.href, pathname, false);
}
