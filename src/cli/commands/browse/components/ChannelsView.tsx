import React from "react";
import type { TermElement } from "terminosaurus";

import { timeAgo } from "../formatters.js";
import type { BrowseTheme, ChannelStats } from "../types.js";

export function ChannelsView({
  channelStats,
  totalThreads,
  selectedIndex,
  itemRefs,
  now,
  theme,
}: {
  channelStats: ChannelStats[];
  totalThreads: number;
  selectedIndex: number;
  itemRefs: React.MutableRefObject<Array<TermElement | null>>;
  now: Date;
  theme: BrowseTheme;
}) {
  const allSelected = selectedIndex === 0;

  return (
    <term:div flexDirection="column" padding={[0, 1]}>
      <term:div
        ref={(el: TermElement | null) => {
          itemRefs.current[0] = el;
        }}
        border={allSelected ? "modern" : "rounded"}
        borderColor={allSelected ? theme.accent : theme.muted}
        padding={[0, 1]}
        marginBottom={1}
        backgroundColor={allSelected ? theme.selected : undefined}
        color={allSelected ? theme.selectedFg : undefined}
        flexDirection="row"
      >
        <term:text fontWeight="bold">{`${allSelected ? "\u25B8" : " "} # all`}</term:text>
        <term:text flexGrow={1} textAlign="right">{`${totalThreads} threads`}</term:text>
      </term:div>

      {channelStats.map((channel, index) => {
        const selected = index + 1 === selectedIndex;
        return (
          <term:div
            key={channel.name}
            ref={(el: TermElement | null) => {
              itemRefs.current[index + 1] = el;
            }}
            border={selected ? "modern" : "rounded"}
            borderColor={selected ? theme.accent : theme.muted}
            padding={[0, 1]}
            marginBottom={1}
            backgroundColor={selected ? theme.selected : undefined}
            color={selected ? theme.selectedFg : undefined}
            flexDirection="row"
          >
            <term:text fontWeight={selected ? "bold" : "normal"}>
              {`${selected ? "\u25B8" : " "} # ${channel.name}`}
            </term:text>
            <term:text flexGrow={1} textAlign="right">
              {`${channel.threadCount} ${channel.threadCount === 1 ? "thread" : "threads"}  |  ${timeAgo(channel.lastActivityAt, now)}`}
            </term:text>
          </term:div>
        );
      })}
    </term:div>
  );
}
