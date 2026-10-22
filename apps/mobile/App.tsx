import { initialState, presets } from '@sandlot/engine';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

const setup = { rules: presets['moraga-mustang-first-half'], pitcherOutsEarlierToday: {} };
const state = initialState(setup);

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sandlot</Text>
      <Text>
        Inning {state.inning}, {state.half}. {state.outs} outs. Count {state.count.balls}-{state.count.strikes}.
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '600' },
});
