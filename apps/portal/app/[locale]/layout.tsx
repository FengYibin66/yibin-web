import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Yibin Feng - Portfolio',
  description: 'Personal portfolio and project showcase',
};

export default function LocaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
