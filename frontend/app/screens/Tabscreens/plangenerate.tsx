/**
 * frontend/app/screens/planscreen/index.tsx
 */
import {
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    StyleSheet,
    ActivityIndicator,
} from "react-native";
import { useState } from "react";
import { FitnessPlan, PlanDay, generatePlan, } from "@/lib/plans"
import { ApiError } from "@/lib/api";
import { colors, spacing, fontSize, borderRadius } from "@/lib/theme";

export default function PlanScreen() {
   
    const [goal, setGoal] = useState("");
    const [daysPerWeek, setDaysPerWeek] = useState("4");
    const [equipment, setEquipment] = useState("Full gym");
    const [constraints, setConstraints] = useState("");

    const [generating, setGenerating] = useState(false);
    const [statusText, setStatusText] = useState("");
    const [error, setError] = useState("");

  
    const [plan, setPlan] = useState<FitnessPlan | null>(null);

    const [expandedDay, setExpandedDay] = useState<number | null>(0);

    const handleGenerate = async () => {
        if (!goal.trim()) {
            setError("Please enter a fitness goal");
            return;
        }

        const days = parseInt(daysPerWeek, 10);
        if (isNaN(days) || days < 1 || days > 7) {
            setError("Days per week must be between 1 and 7");
            return;
        }

        setError("");
        setGenerating(true);
        setPlan(null);

        try {
            const result = await generatePlan(
                {
                    goal: goal.trim(),
                    days_per_week: days,
                    equipment: equipment.trim() || "Full gym",
                    constraints: constraints.trim() || "none",
                },
                (status) => setStatusText(status)
            );
            setPlan(result);
        } catch (e: any) {
            setError(e.message || "Failed to generate plan");
        } finally {
            setGenerating(false);
            setStatusText("");
        }
    };

    const handleReset = () => {
        setPlan(null);
        setError("");
    };

    const toggleDay = (index: number) => {
        setExpandedDay(expandedDay === index ? null : index);
    };


    if (plan) {
        return (
            <ScrollView style={s.scrollView} showsVerticalScrollIndicator={false}>
                <Text style={s.pageTitle}>Your Plan</Text>
                <Text style={s.planName}>{plan.plan_name}</Text>

                {plan.notes ? (
                    <View style={s.notesCard}>
                        <Text style={s.notesLabel}>Coach Notes</Text>
                        <Text style={s.notesText}>{plan.notes}</Text>
                    </View>
                ) : null}

                {/* display by days */}
                {plan.days.map((day, index) => (
                    <DayCard
                        key={index}
                        day={day}
                        index={index}
                        expanded={expandedDay === index}
                        onToggle={() => toggleDay(index)}
                    />
                ))}

                {/* if AI return null days，display the original notes */}
                {plan.days.length === 0 && plan.notes ? (
                    <View style={s.rawTextCard}>
                        <Text style={s.rawText}>{plan.notes}</Text>
                    </View>
                ) : null}

                {/* regenerate */}
                <TouchableOpacity style={s.resetButton} onPress={handleReset}>
                    <Text style={s.resetButtonText}>Generate New Plan</Text>
                </TouchableOpacity>

                <View style={{ height: 120 }} />
            </ScrollView>
        );
    }

    // no plan display the generate list─
    return (
        <ScrollView style={s.scrollView} showsVerticalScrollIndicator={false}>
            <Text style={s.pageTitle}>AI Fitness Plan</Text>
            <Text style={s.pageSubtitle}>
                Tell us about your goals and we'll create a personalized workout plan
            </Text>

            <View style={s.formCard}>
                <Text style={s.label}>What's your goal?</Text>
                <TextInput
                    style={s.input}
                    value={goal}
                    onChangeText={setGoal}
                    placeholder="e.g. Build muscle and lose fat"
                    placeholderTextColor={colors.textMuted}
                    editable={!generating}
                />

                <Text style={s.label}>Days per week</Text>
                <View style={s.dayPicker}>
                    {[2, 3, 4, 5, 6].map((d) => (
                        <TouchableOpacity
                            key={d}
                            style={[
                                s.dayOption,
                                daysPerWeek === String(d) && s.dayOptionActive,
                            ]}
                            onPress={() => setDaysPerWeek(String(d))}
                            disabled={generating}
                        >
                            <Text
                                style={[
                                    s.dayOptionText,
                                    daysPerWeek === String(d) && s.dayOptionTextActive,
                                ]}
                            >
                                {d}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={s.label}>Available equipment</Text>
                <TextInput
                    style={s.input}
                    value={equipment}
                    onChangeText={setEquipment}
                    placeholder="e.g. Full gym, dumbbells only"
                    placeholderTextColor={colors.textMuted}
                    editable={!generating}
                />

                <Text style={s.label}>Injuries or constraints</Text>
                <TextInput
                    style={s.input}
                    value={constraints}
                    onChangeText={setConstraints}
                    placeholder="e.g. Bad left knee, none"
                    placeholderTextColor={colors.textMuted}
                    editable={!generating}
                />
            </View>

            {error ? <Text style={s.errorText}>{error}</Text> : null}

            <TouchableOpacity
                style={[s.generateButton, generating && { opacity: 0.7 }]}
                onPress={handleGenerate}
                disabled={generating}
                activeOpacity={0.85}
            >
                {generating ? (
                    <View style={s.generatingRow}>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={s.generateButtonText}>
                            {statusText || "Generating..."}
                        </Text>
                    </View>
                ) : (
                    <Text style={s.generateButtonText}>Generate Plan</Text>
                )}
            </TouchableOpacity>

            <View style={{ height: 120 }} />
        </ScrollView>
    );
}

// ─── DayCard  ──────────────────────────────────

function DayCard({
    day,
    index,
    expanded,
    onToggle,
}: {
    day: PlanDay;
    index: number;
    expanded: boolean;
    onToggle: () => void;
}) {
    return (
        <View style={s.dayCard}>
     
            <TouchableOpacity style={s.dayHeader} onPress={onToggle} activeOpacity={0.7}>
                <View style={s.dayBadge}>
                    <Text style={s.dayBadgeText}>Day {index + 1}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={s.dayTitle}>{day.day}</Text>
                    <Text style={s.dayFocus}>{day.focus}</Text>
                </View>
                <Text style={s.chevron}>{expanded ? "▾" : "›"}</Text>
            </TouchableOpacity>

            {expanded && (
                <View style={s.dayBody}>
                    {day.exercises.map((ex, i) => (
                        <View key={i} style={s.exerciseRow}>
                            <View style={s.exerciseNumberWrap}>
                                <Text style={s.exerciseNumber}>{i + 1}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.exerciseName}>{ex.name}</Text>
                                <Text style={s.exerciseMeta}>
                                    {ex.sets} sets × {ex.reps} reps · {ex.rest_seconds}s rest
                                </Text>
                                {ex.notes ? (
                                    <Text style={s.exerciseNotes}>{ex.notes}</Text>
                                ) : null}
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}


const s = StyleSheet.create({
    scrollView: {
        flex: 1,
        backgroundColor: colors.bg,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xxl,
    },
    pageTitle: {
        fontSize: fontSize.xxl,
        fontWeight: "bold",
        color: colors.text,
    },
    pageSubtitle: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
        lineHeight: 20,
    },
    planName: {
        fontSize: fontSize.lg,
        color: colors.primary,
        fontWeight: "600",
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
    },

    // ─── Form ─────────────────────────────────────────
    formCard: {
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.md,
    },
    label: {
        fontSize: fontSize.sm,
        fontWeight: "600",
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        marginTop: spacing.md,
    },
    input: {
        backgroundColor: colors.bgInput,
        color: colors.text,
        borderRadius: borderRadius.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        fontSize: fontSize.md,
        borderWidth: 1,
        borderColor: colors.border,
    },

    // ─── Day picker ───────────────────────────────────
    dayPicker: {
        flexDirection: "row",
        gap: spacing.sm,
    },
    dayOption: {
        flex: 1,
        height: 44,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.bgInput,
    },
    dayOptionActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    dayOptionText: {
        fontSize: fontSize.md,
        fontWeight: "600",
        color: colors.textSecondary,
    },
    dayOptionTextActive: {
        color: colors.text,
    },

    // ─── Generate button ──────────────────────────────
    generateButton: {
        height: 54,
        borderRadius: borderRadius.md,
        backgroundColor: colors.primary,
        justifyContent: "center",
        alignItems: "center",
    },
    generateButtonText: {
        color: colors.text,
        fontSize: fontSize.lg,
        fontWeight: "700",
    },
    generatingRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    errorText: {
        color: colors.danger,
        fontSize: fontSize.sm,
        marginBottom: spacing.md,
    },

    // ─── Notes card ───────────────────────────────────
    notesCard: {
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    notesLabel: {
        fontSize: fontSize.xs,
        fontWeight: "600",
        color: colors.primary,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: spacing.xs,
    },
    notesText: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 20,
    },

    // ─── Day card ─────────────────────────────────────
    dayCard: {
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.sm,
        overflow: "hidden",
    },
    dayHeader: {
        flexDirection: "row",
        alignItems: "center",
        padding: spacing.md,
    },
    dayBadge: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primary,
        justifyContent: "center",
        alignItems: "center",
    },
    dayBadgeText: {
        fontSize: 11,
        fontWeight: "700",
        color: colors.text,
    },
    dayTitle: {
        fontSize: fontSize.md,
        fontWeight: "600",
        color: colors.text,
    },
    dayFocus: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        marginTop: 2,
    },
    chevron: {
        fontSize: 18,
        color: colors.textMuted,
        marginLeft: spacing.sm,
    },

    // ─── Day body (expanded) ──────────────────────────
    dayBody: {
        borderTopWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.sm,
    },
    exerciseRow: {
        flexDirection: "row",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        alignItems: "flex-start",
    },
    exerciseNumberWrap: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.bgInput,
        justifyContent: "center",
        alignItems: "center",
        marginRight: spacing.md,
        marginTop: 2,
    },
    exerciseNumber: {
        fontSize: fontSize.xs,
        fontWeight: "600",
        color: colors.textSecondary,
    },
    exerciseName: {
        fontSize: fontSize.sm,
        fontWeight: "600",
        color: colors.text,
    },
    exerciseMeta: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        marginTop: 2,
    },
    exerciseNotes: {
        fontSize: fontSize.xs,
        color: colors.textMuted,
        marginTop: 4,
        fontStyle: "italic",
    },

    // ─── Raw text fallback ────────────────────────────
    rawTextCard: {
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    rawText: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 22,
    },

    // ─── Reset button ─────────────────────────────────
    resetButton: {
        height: 50,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.primary,
        justifyContent: "center",
        alignItems: "center",
        marginTop: spacing.md,
    },
    resetButtonText: {
        color: colors.primary,
        fontSize: fontSize.md,
        fontWeight: "600",
    },
});