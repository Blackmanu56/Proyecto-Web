type ReposicionDescripcionProps = {
  reposicionFila: {
    principal: string;
    secundaria: string;
  };
};

export function ReposicionDescripcion({
  reposicionFila,
}: ReposicionDescripcionProps) {
  return (
    <div className="max-w-[400px] overflow-hidden">
      <span className="block whitespace-nowrap overflow-hidden text-ellipsis">
        {reposicionFila.principal}
      </span>
      {reposicionFila.secundaria && (
        <span className="mt-0.5 block whitespace-nowrap overflow-hidden text-ellipsis text-[10px] text-[var(--text-muted)]">
          {reposicionFila.secundaria}
        </span>
      )}
    </div>
  );
}
