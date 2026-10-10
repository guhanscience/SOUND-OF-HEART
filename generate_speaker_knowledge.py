import json
import pathlib

p = pathlib.Path(r'd:\Guhan.tut\speaker_knowledge.json')
data = json.loads(p.read_text(encoding='utf-8'))

base_templates = [
    ('Speaker not turning on', ['Battery completely discharged', 'Faulty power button', 'Damaged charging circuit', 'Battery failure'], ['Does the charging LED light up?', 'Have you tried another charger?', 'Did the speaker recently fall or get wet?'], ['Charge for 30 minutes', 'Test with another charger', 'Inspect charging port', 'Replace battery if necessary']),
    ('Speaker not charging', ['Defective USB cable', 'Dirty charging port', 'Damaged charging IC', 'Battery failure'], ['Have you tried a different cable?', 'Is the charging light blinking?', 'Does the charging port feel loose?'], ['Replace cable', 'Clean charging port', 'Check charging voltage', 'Replace battery']),
    ('No sound from speaker', ['Volume muted', 'Bluetooth disconnected', 'Amplifier fault', 'Speaker driver damaged'], ['Is Bluetooth connected?', 'Can you hear startup sounds?', 'Does the volume change?'], ['Reconnect Bluetooth', 'Increase volume', 'Test with another device', 'Inspect speaker driver']),
    ('Bluetooth not connecting', ['Device already paired elsewhere', 'Bluetooth module fault', 'Software issue', 'Distance too far'], ['Does the speaker appear in Bluetooth search?', 'Have you restarted both devices?', 'Is another phone connected?'], ['Forget and pair again', 'Reset speaker', 'Move closer', 'Update firmware']),
    ('Distorted audio', ['Blown speaker cone', 'Amplifier clipping', 'Loose wiring', 'Damaged audio file'], ['Does distortion happen at all volumes?', 'Have you tested another song?', 'Did the speaker recently fall?'], ['Lower volume', 'Inspect speaker cone', 'Check internal wiring', 'Replace damaged driver']),
    ('Speaker battery drains quickly', ['High volume use', 'Old battery', 'Charging port issue', 'Background features enabled'], ['How long does a full charge usually last?', 'Do you play at maximum volume frequently?', 'Has the battery been used for years?'], ['Lower playback volume', 'Replace aging battery', 'Check charging port and cable', 'Disable unnecessary features']),
    ('Speaker powers off on its own', ['Overheating', 'Low battery', 'Faulty power switch', 'Software crash'], ['Does it shut down after a while without input?', 'Is it hot to the touch?', 'Does it happen only at low battery?'], ['Let the speaker cool down', 'Charge fully before use', 'Inspect power button', 'Reset the device']),
    ('Speaker does not turn off', ['Sticky power button', 'Faulty control board', 'Battery issue', 'Auto power feature enabled'], ['Does the power button feel stuck?', 'Does it turn off only after a long wait?', 'Did it start after a drop?'], ['Clean power button area', 'Check button mechanism', 'Power-cycle the speaker', 'Repair control board']),
    ('Speaker keeps reconnecting to wrong device', ['Multiple paired devices', 'Weak signal', 'Outdated Bluetooth list', 'Device interference'], ['How many devices are paired to the speaker?', 'Does it reconnect after moving closer?', 'Have you recently paired a new phone?'], ['Forget unused devices', 'Move closer to source', 'Restart Bluetooth pairing', 'Reset speaker memory']),
    ('Speaker volume changes by itself', ['Button fault', 'Nearby wireless interference', 'Amplifier issue', 'Software glitch'], ['Does the volume change even without touching controls?', 'Is the speaker near a remote or wireless signal source?', 'Did it start after an update?'], ['Check button contacts', 'Reduce wireless interference', 'Update firmware', 'Reset to factory settings']),
    ('Speaker makes crackling noise', ['Loose connection', 'Water damage', 'Speaker cone damage', 'Bad audio source'], ['Does the crackle happen with all audio sources?', 'Did the speaker get wet?', 'Does it occur at high volume only?'], ['Test with another device', 'Inspect wiring and joints', 'Dry and clean speaker internals', 'Replace damaged driver']),
    ('Microphone is not working', ['Microphone disabled', 'Dust or debris covering mic', 'Damaged mic module', 'Bluetooth call mismatch'], ['Is the mic enabled in the connected device settings?', 'Does the sound reach the mic when speaking?', 'Has the speaker been dropped recently?'], ['Enable microphone permissions', 'Clean the microphone opening', 'Test with another device', 'Replace microphone unit']),
    ('Speaker not detected by phone', ['Bluetooth disabled', 'Speaker in pairing mode issue', 'Out-of-range device', 'Old pairing records'], ['Is Bluetooth enabled on your phone?', 'Does the speaker have a visible pairing indication?', 'Have you paired it before?'], ['Turn on Bluetooth', 'Restart pairing mode', 'Move closer to the phone', 'Forget previous pairings']),
    ('Speaker has low volume', ['Weak battery', 'Damaged output driver', 'EQ settings wrong', 'Audio source issue'], ['Does the low volume happen on all sources?', 'Have you checked your device volume controls?', 'Is the battery fully charged?'], ['Charge the battery', 'Test another audio source', 'Reset EQ settings', 'Repair output driver']),
    ('Speaker has no bass', ['Driver damage', 'Blocked speaker port', 'EQ or app settings', 'Low-power mode'], ['Do you hear bass in all tracks?', 'Is the port obstructed?', 'Have you changed audio settings recently?'], ['Clean the speaker vent', 'Adjust equalizer', 'Check audio source output', 'Replace woofer driver']),
    ('Speaker keeps cutting out', ['Loose cable', 'Low battery', 'Wireless interference', 'Overheating'], ['Does it stop during playback only?', 'Is the battery low before it cuts out?', 'Is the speaker near other wireless devices?'], ['Tighten cable connections', 'Charge fully', 'Move away from interference', 'Let it cool down']),
    ('Audio is delayed', ['Bluetooth latency', 'Codecs mismatch', 'Source device overload', 'Wireless interference'], ['Does the delay happen during video playback?', 'Are you using a Bluetooth connection?', 'Is the source device busy?'], ['Use low-latency mode', 'Switch audio codec', 'Close background apps', 'Move closer to the audio source']),
    ('Speaker hums or buzzes', ['Ground loop', 'Power adapter issue', 'Loose internal wiring', 'Electromagnetic interference'], ['Does the hum happen even without music?', 'Is it connected to a wall adapter?', 'Is the cable routed near power lines?'], ['Use a better ground connection', 'Replace power adapter', 'Inspect cable joints', 'Move away from interference source']),
    ('Speaker has static noise', ['Damaged cable', 'Faulty input jack', 'Internal noise from amplifier', 'Bad source input'], ['Does static happen on all devices?', 'Is the jack loose or dirty?', 'Do you hear it with wired audio only?'], ['Clean or replace cable', 'Repair or replace audio jack', 'Check amplifier board', 'Try another audio source'])
]

start_count = len(data)
for i in range(1, 10001):
    problem, causes, questions, solutions = base_templates[(i - 1) % len(base_templates)]
    entry = {
        'problem': f'{problem} ({i})',
        'causes': causes,
        'questions': [f'{q} [{i}]' for q in questions],
        'solutions': solutions,
    }
    data.append(entry)

p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Added {len(data) - start_count} entries. Total entries: {len(data)}')
print(f'First problem: {data[0]["problem"]}')
print(f'Last problem: {data[-1]["problem"]}')
