
import { ScrollView, Text, TouchableOpacity, View, ActivityIndicator, TextInput, Alert, StyleSheet, Dimensions } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { act, useCallback, useEffect, useState } from "react";
import { WorkoutLog, WorkoutSet, fetchDailyExercisesHistory, logWorkout, } from "@/lib/exercises";
import { LineChart } from "react-native-chart-kit";
import { colors, spacing, fontSize, borderRadius } from "@/lib/theme";



type WorkoutData = {
  day: string;
  chest: number;
  back: number;
  legs: number;
  shoulders: number;
  arms: number;
}

export default function SelectedExerciseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string; id?: string }>();

  const exerciseName = params.name || "Exercise";
  const exerciseId = Number(params.id) || 0;


  const [history, setHistory] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");


  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await fetchDailyExercisesHistory();
      setHistory(data);
      setError("");
    } catch (e: any) {
      setError(e.message || "Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  const sortedHistory = [...history].sort(
  (a, b) => new Date(a.performed_at).getTime() - new Date(b.performed_at).getTime()
);

  const checkDetails = (details: WorkoutLog) => {
    router.push({
      pathname: "/screens/navigatescreens/details",
      params: { name: details.notes, id: String(details.id) }
    })
  };

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [exerciseId])
  );

  return (
    <ScrollView style={s.scrollView} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={s.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>{exerciseName}</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Chart */}
      <View style={s.historyCard}>
        {history && history.length > 0 ? (
          <View style={{ borderRadius: borderRadius.md, overflow: 'hidden' }}>
            <LineChart data={{
              labels: sortedHistory.map(item => item.performed_at.slice(5, 10) || ''),
              datasets: [
                { data: sortedHistory.map(item => item.volume || 0), color: () => "rgb(255,99,132)" },
                { data: sortedHistory.map(item => item.calories || 0), color: () => "blue" },
              ], legend: ["Volume", "Calories"],
            }}
              width={Dimensions.get("window").width - 66}
              height={220}
              chartConfig={{
                backgroundGradientFrom: colors.bgCard,
                backgroundGradientTo: colors.bgCard,
                color: () => 'white',
                style: {
                  borderRadius: borderRadius.md,
                },
                propsForBackgroundLines: {
                  strokeDasharray: "5,5",
                  stroke: "rgba(255, 255, 255, 0.3)",
                }
              }} bezier />
          </View>
        ) : (
          <View style={{ height: 220, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: 'white' }}>
              No history data
            </Text>
          </View>
        )}
      </View>

      {/* History */}
      <Text style={s.sectionTitle}>Previous Workouts</Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : error ? (
        <Text style={{ color: colors.danger, marginTop: spacing.md }}>{error}</Text>
      ) : history.length === 0 ? (
        <Text style={{ color: colors.textMuted, marginTop: spacing.md }}>
          No workouts yet. Log your first one above!
        </Text>
      ) : (
        history.map((log) => (
          <TouchableOpacity key={log.id} style={s.historyCard} onPress={()=>checkDetails(log)} activeOpacity={0.7}>
          <View>
            <Text style={s.historyDate}>{log.performed_at.slice(0,10)}</Text>
            <Text style={s.headerCell}>{log.notes}</Text>
            <View style={s.tableHeader}>
              <Text style={s.headerCell}>Volume</Text>
              <Text style={s.headerCell}>Calories</Text>
            </View>
            <View style={s.tableRow}>
              <Text style={s.cell}>{log.volume}</Text>
              <Text style={s.cell}>{log.calories}</Text>
            </View>
          </View>
          </TouchableOpacity>
        ))
      )}

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgCard,
    justifyContent: "center",
    alignItems: "center",
  },
  backText: { fontSize: 22, color: colors.text, marginTop: -2 },
  title: {
    flex: 1,
    fontSize: fontSize.xl,
    fontWeight: "bold",
    color: colors.text,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  headerCell: {
    flex: 1,
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  cell: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  setInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginHorizontal: 4,
    fontSize: fontSize.sm,
    textAlign: "center",
    color: colors.text,
    backgroundColor: colors.bgInput,
  },
  buttonRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  outlineButton: {
    flex: 1,
    height: 38,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  outlineButtonText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.primary,
  },
  solidButton: {
    flex: 1,
    height: 38,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  solidButtonText: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  historyCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  historyDate: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});