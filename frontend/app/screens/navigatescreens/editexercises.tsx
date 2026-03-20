
import { ScrollView, Text, TouchableOpacity, View, ActivityIndicator, TextInput, Alert, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { WorkoutSet, deleteSet, fetchExerciseHistory, logWorkout, } from "@/lib/exercises";
import { Dimensions } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { ApiError } from "@/lib/api";
import { colors, spacing, fontSize, borderRadius } from "@/lib/theme";



export default function SelectedExerciseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string; id?: string }>();

  const exerciseName = params.name || "Exercise";
  const exerciseId = Number(params.id) || 0;


  const [history, setHistory] = useState<WorkoutSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");



  const [newSets, setNewSets] = useState<
    { weight: string; reps: string }[]
  >([{ weight: "", reps: "" }]);
  const [submitting, setSubmitting] = useState(false);


  const loadHistory = async () => {
    if (!exerciseId) return;
    try {
      setLoading(true);
      const data = await fetchExerciseHistory(exerciseId);
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
  }, [exerciseId]);


  const addSet = () => {
    setNewSets([...newSets, { weight: "", reps: "" }]);
  };

  const removeSet = (index: number) => {
    if (newSets.length <= 1) return;
    setNewSets(newSets.filter((_, i) => i !== index));
  };

  const updateSet = (index: number, field: "weight" | "reps", value: string) => {
    const updated = [...newSets];
    updated[index] = { ...updated[index], [field]: value };
    setNewSets(updated);
  };

  const handleSubmitWorkout = async () => {
    const parsedSets = newSets.map((s, i) => ({
      set_number: i + 1,
      weight: parseFloat(s.weight),
      reps: parseInt(s.reps, 10),
    }));

    const hasInvalid = parsedSets.some(
      (s) => isNaN(s.weight) || isNaN(s.reps) || s.weight <= 0 || s.reps <= 0
    );
    if (hasInvalid) {
      Alert.alert("Invalid input", "Please fill in weight and reps for all sets.");
      return;
    }

    setSubmitting(true);
    try {
      await logWorkout(exerciseId, parsedSets);
      setNewSets([{ weight: "", reps: "" }]);
      await loadHistory();
      Alert.alert("Saved!", "Workout logged successfully.");
    } catch (e) {
      const apiErr = e as ApiError;
      Alert.alert("Error", apiErr.message || "Failed to save workout");
    } finally {
      setSubmitting(false);
    }
  };

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

  const sortedHistory = [...history].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );


  const dataForGraph = sortedHistory.map(set => {
    const sets = set.sets || [];

    const { totalWeight, totalReps } = sets.reduce(
      (acc, set) => {
        acc.totalWeight += set.weight || 0;
        acc.totalReps += set.reps || 0;
        return acc;
      },
      { totalWeight: 0, totalReps: 0 }
    );

    const count = sets.length;

    return {
      avg_weight: count ? totalWeight / count : 0,
      avg_reps: count ? totalReps / count : 0,
    };
  });

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
              labels: sortedHistory.map(item => item.created_at.slice(0, 10) || ''),
              datasets: [
                { data: dataForGraph.map(item => item.avg_weight || 0), color: () => "rgb(255,99,132)" },
                { data: dataForGraph.map(item => item.avg_reps || 0), color: () => "blue" },
              ], legend: ["Avg_Weight", "Avg_Reps"],
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

      {/* Log Workout */}
      <Text style={s.sectionTitle}>Log Workout</Text>
      <View style={s.card}>
        <View style={s.tableHeader}>
          <Text style={[s.headerCell, { flex: 0.5 }]}>Set</Text>
          <Text style={s.headerCell}>Weight</Text>
          <Text style={s.headerCell}>Reps</Text>
          <View style={{ flex: 0.4 }} />
        </View>

        {newSets.map((set, index) => (
          <View key={index} style={s.tableRow}>
            <Text style={[s.cell, { flex: 0.5 }]}>{index + 1}</Text>
            <TextInput
              style={s.setInput}
              value={set.weight}
              onChangeText={(v) => updateSet(index, "weight", v)}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              editable={!submitting}
            />
            <TextInput
              style={s.setInput}
              value={set.reps}
              onChangeText={(v) => updateSet(index, "reps", v)}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              editable={!submitting}
            />
            <TouchableOpacity
              style={{ flex: 0.4, alignItems: "center" }}
              onPress={() => removeSet(index)}
              disabled={newSets.length <= 1}
            >
              <Text style={{ color: newSets.length <= 1 ? colors.textMuted : colors.danger, fontSize: 16 }}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        <View style={s.buttonRow}>
          <TouchableOpacity style={s.outlineButton} onPress={addSet} disabled={submitting}>
            <Text style={s.outlineButtonText}>+ Add Set</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.solidButton, submitting && { opacity: 0.6 }]}
            onPress={handleSubmitWorkout}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.solidButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
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
        history.map((workout) => (
          <View key={workout.workout_log_id} style={s.historyCard}>
            <Text style={s.historyDate}>{workout.created_at.slice(0, 10)}</Text>
            <View style={s.tableHeader}>
              <Text style={s.headerCell}>Set</Text>
              <Text style={s.headerCell}>Weight</Text>
              <Text style={s.headerCell}>Reps</Text>
            </View>
            {workout.sets.map((set)=>(
              <View key={`${workout.workout_log_id}-${set.set_number}`} style={s.tableRow}>
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