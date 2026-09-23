export function WhatsAppLink({
  href,
  label = "WhatsApp",
}: {
  href: string | null;
  label?: string;
}) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-700 text-sm">
      {label}
    </a>
  );
}
