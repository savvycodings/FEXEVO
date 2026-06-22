import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BenchScoreRing } from "./BenchScoreRing";
import type { BenchSubmission } from "../../lib/adminRetrievalBenchApi";

type Props = {
  item: BenchSubmission;
  selected: boolean;
  onSelect: () => void;
  theme: { semiBoldFont: string; regularFont: string; mediumFont: string };
};

export function BenchSubmissionCard({ item, selected, onSelect, theme }: Props) {
  const shotShort =
    item.shot.length > 18 ? `${item.shot.slice(0, 16)}…` : item.shot;

  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onSelect}
      onLongPress={() => {
        if (item.videoUrl) void Linking.openURL(item.videoUrl);
      }}
      activeOpacity={0.85}
    >
      <BenchScoreRing
        value={item.score ?? 0}
        size={48}
        fontFamily={theme.semiBoldFont}
      />
      <Text style={[styles.user, { fontFamily: theme.semiBoldFont }]} numberOfLines={1}>
        {item.username}
      </Text>
      <Text style={[styles.shot, { fontFamily: theme.regularFont }]} numberOfLines={1}>
        {shotShort}
      </Text>
      <View style={styles.metaRow}>
        {item.hasMesh ? (
          <Text style={[styles.badge, { fontFamily: theme.mediumFont }]}>mesh</Text>
        ) : null}
        {item.embedding_source ? (
          <Text style={[styles.badge, { fontFamily: theme.mediumFont }]} numberOfLines={1}>
            {item.embedding_source}
          </Text>
        ) : null}
        <TouchableOpacity
          hitSlop={8}
          onPress={() => {
            if (item.videoUrl) void Linking.openURL(item.videoUrl);
          }}
        >
          <Ionicons name="play-circle-outline" size={16} color="#00BBFF" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 108,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginRight: 10,
    borderRadius: 12,
    backgroundColor: "rgba(8, 24, 48, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
  },
  cardSelected: {
    borderColor: "#00BBFF",
    backgroundColor: "rgba(0, 100, 180, 0.25)",
  },
  user: {
    color: "#E8F2FF",
    fontSize: 12,
    marginTop: 6,
    maxWidth: 96,
  },
  shot: {
    color: "#86A7D2",
    fontSize: 10,
    marginTop: 2,
    maxWidth: 96,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  badge: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 8,
    textTransform: "lowercase",
  },
});
