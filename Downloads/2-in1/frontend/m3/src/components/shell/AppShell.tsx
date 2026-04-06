import React from 'react';

interface AppShellProps {
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  sidebarClassName?: string;
  contentClassName?: string;
}

const AppShell: React.FC<AppShellProps> = ({
  header,
  sidebar,
  children,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  sidebarClassName = '',
  contentClassName = '',
}) => {
  return (
    <div className={`min-h-screen bg-surface-alt text-foreground font-sans ${className}`}>
      {header && <div className={headerClassName}>{header}</div>}
      <div className={`flex ${bodyClassName}`}>
        {sidebar && <div className={sidebarClassName}>{sidebar}</div>}
        <main className={`flex-1 ${contentClassName}`}>{children}</main>
      </div>
    </div>
  );
};

export default AppShell;
