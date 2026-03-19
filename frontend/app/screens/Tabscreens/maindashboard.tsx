import { Text, TouchableOpacity, ScrollView,ActivityIndicator,View,StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Exercise, fetchExercises } from "@/lib/exercises";
import { colors, spacing, fontSize, borderRadius } from "@/lib/theme";

export default function Dashboard() {
  const router = useRouter();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // useFocusEffect 而不是 useEffect 的原因：
  // 用户在 customerexercise 页面创建了新训练后回到这个页面，
  // useEffect 不会重新执行（组件没卸载），但 useFocusEffect 会。
  // 这样每次切回 Dashboard tab 都会刷新列表。
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        try {
          setLoading(true);
          const data = await fetchExercises();
          if (!cancelled) {
            setExercises(data);
            setError("");
          }
        } catch (e: any) {
          if (!cancelled) {
            setError(e.message || "Failed to load exercises");
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      // cleanup：如果用户在请求完成前就切走了，不更新state
      return () => { cancelled = true; };
    }, [])
  );

  const handleSelectExercise = (exercise: Exercise) => {
    router.push({
      pathname: "/screens/navigatescreens/editexercises",
      params: { name: exercise.name, id: String(exercise.id) },
    });
  };

 return (
    <ScrollView
      style={s.scrollView}
      contentContainerStyle={s.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={s.header}>ChangeNow</Text>
      <Text style={s.welcome}>Ready to train?</Text>

      {/* 新增训练按钮 */}
      <TouchableOpacity
        style={s.addCard}
        onPress={() => router.push("/screens/navigatescreens/customerexercise")}
        activeOpacity={0.7}
      >
        <Text style={s.addCardPlus}>+</Text>
        <Text style={s.addCardText}>New Exercise</Text>
      </TouchableOpacity>

      {/* 训练列表 */}
      <Text style={s.sectionTitle}>My Exercises</Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : error ? (
        <Text style={s.errorText}>{error}</Text>
      ) : exercises.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>🏋️</Text>
          <Text style={s.emptyText}>No exercises yet</Text>
          <Text style={s.emptySubtext}>Tap + above to create your first one!</Text>
        </View>
      ) : (
        exercises.map((exercise) => (
          <TouchableOpacity
            key={exercise.id}
            style={s.exerciseCard}
            onPress={() => handleSelectExercise(exercise)}
            activeOpacity={0.7}
          >
            <View style={s.exerciseIconWrap}>
              <Text style={{ fontSize: 24 }}>🏋️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.exerciseName}>{exercise.name}</Text>
              <Text style={s.exerciseType}>{exercise.type}</Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        ))
      )}

      {/* 底部留白给 TabBar */}
      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    padding: spacing.lg,
    paddingTop: spacing.xxl,
  },
  header: {
    fontSize: fontSize.xxl,
    fontWeight: "bold",
    color: colors.primary,
    letterSpacing: 1,
  },
  welcome: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  addCard: {
    height: 100,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
    flexDirection: "row",
    gap: spacing.sm,
  },
  addCardPlus: {
    fontSize: 28,
    fontWeight: "300",
    color: colors.primary,
  },
  addCardText: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: spacing.md,
  },
  exerciseCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  exerciseIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bgInput,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  exerciseName: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
  },
  exerciseType: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: 24,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    marginTop: spacing.md,
  },
  emptyState: {
    alignItems: "center",
    marginTop: spacing.xl,
    paddingVertical: spacing.xl,
  },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});