import { ReactNode } from "react";

export default function EmployeesListLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", width: "100%", minHeight: "calc(100vh - 64px)", background: "var(--bg)" }}>
      {/* Main Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
