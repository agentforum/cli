import React from "react";

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: { color: string; backgroundColor: string };
}) {
  return (
    <term:text
      color={tone.color}
      backgroundColor={tone.backgroundColor}
      padding={[0, 1]}
      marginRight={1}
      fontWeight="bold"
    >
      {` ${label} `}
    </term:text>
  );
}
