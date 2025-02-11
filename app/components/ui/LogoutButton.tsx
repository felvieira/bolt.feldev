// app/components/ui/LogoutButton.tsx
import { Link } from "@remix-run/react";

export function LogoutButton() {
  return (
    <Link to="/logout">
      <button className="flex items-center p-1.5 rounded-md bg-bolt-elements-item-backgroundDefault hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary">
        {/* Usando o ícone atualizado */}
        <div className="i-ph:sign-out text-lg" />
      </button>
    </Link>
  );
}
