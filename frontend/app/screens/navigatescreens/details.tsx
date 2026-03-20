
import { ScrollView, Text, TouchableOpacity, View, ActivityIndicator, TextInput, Alert, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { WorkoutLog, WorkoutSet, deleteSet, fetchDailyExercisesDetails, fetchDailyExercisesHistory, logWorkout, } from "@/lib/exercises";
import { Dimensions } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { ApiError } from "@/lib/api";
import { colors, spacing, fontSize, borderRadius } from "@/lib/theme";



export default function SelectedExerciseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string; id?: string }>();

  const exerciseName = params.name || "Exercise";
  const WorkoutId = Number(params.id) || 0;


  const [history, setHistory] = useState<WorkoutSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");


  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await fetchDailyExercisesDetails(WorkoutId);
      setHistory(data);
      setError("");
    } catch (e: any) {
      setError(e.message || "Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [WorkoutId]);


    const deleteSetFromPrevious = async (index: number) => {
      try {
        await deleteSet(index);
        await loadHistory();
        Alert.alert("Saved!", "Set deleted successfully.");
      } catch (e) {
        const apiErr = e as ApiError;
        Alert.alert("Error", apiErr.message || "Failed to delete set");
      }
    };
  


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
          <View key={log.exercise_id} style={s.historyCard}>
            <Text style={s.historyDate}>{log.created_at.slice(0, 10)}</Text>
            <Text style={s.historyDate}>{log.exercise_name}</Text>
            <View style={s.tableHeader}>
              <Text style={s.headerCell}>Set</Text>
              <Text style={s.headerCell}>Weight</Text>
              <Text style={s.headerCell}>Reps</Text>
            </View>
            {log.sets.map((set) => (
              <View key={`${log.workout_log_id}-${set.id}`} style={s.tableRow}>
                <Text style={s.cell}>{set.set_number}</Text>
                <Text style={s.cell}>{set.weight}</Text>
                <Text style={s.cell}>{set.reps}</Text>
                {/** delete ste */}
                <TouchableOpacity
                  style={{ flex: 0.4, alignItems: "center" }}
                  onPress={() => deleteSetFromPrevious(set.id)}
                >
                  <Text style={{ color: colors.danger, fontSize: 16 }}>
                    ✕
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
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