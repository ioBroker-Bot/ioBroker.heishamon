# HeishaMon Datenpunkte – Protokoll-Dokumentation

**Status:** Single Source of Truth für Datenpunkt-Definitionen  
**Quelle:** `vendor/heishamon-upstream/HeishaMon/decode.h`, `MQTT-Topics.md`, `commands.cpp`  
**Verwendung:** Phase 1 der Clean-Room-Reimplementierung in TypeScript (1:1 Portierung)

Die folgende Dokumentation extrahiert die Datenpunkte direkt aus dem HeishaMon-C++-Quellcode. Jeder Datenpunkt wird mit seinem Byte-Offset im 203-Byte-Heatpump-Response-Frame, der Decoder-Funktion, Einheit, Beschreibung und Schreibbarkeit dokumentiert.

---

## Tabelle 1: Haupt-Frame-Datenpunkte (TOP0–TOP143)

| ID | Name | Byte | Decoder | Einheit | Beschreibung | Beispielwerte/Range | Schreibbar |
|:---|:---|:---:|:---|:---|:---|:---|:---|
| TOP0 | Heatpump_State | 4 | getBit7and8 | On/Off | Heatpump-Status | 0=Off, 1=On | Ja (set_heatpump_state) |
| TOP1 | Pump_Flow | 0 | unknown | l/min | Umwälzpumpen-Durchfluss | 0–100+ | ? |
| TOP2 | Force_DHW_State | 4 | getBit1and2 | — | Warmwassererzeugung erzwingen | 0=Off, 1=On | Ja (set_force_DHW) |
| TOP3 | Quiet_Mode_Schedule | 7 | getBit1and2 | — | Zeitplan für Leise-Modus | 0=Inaktiv, 1=Aktiv | ? |
| TOP4 | Operating_Mode_State | 6 | getOpMode | — | Betriebsmodus | 0=Heat, 1=Cool, 2=Auto(H), 3=DHW, 4=Heat+DHW, 5=Cool+DHW, 6=Auto(H)+DHW, 7=Auto(C), 8=Auto(C)+DHW | Ja (set_operation_mode) |
| TOP5 | Main_Inlet_Temp | 143 | getIntMinus128 | °C | Haupteinlass-Wassertemperatur | -50–50 | — |
| TOP6 | Main_Outlet_Temp | 144 | getIntMinus128 | °C | Hauptauslass-Wassertemperatur | -50–50 | — |
| TOP7 | Main_Target_Temp | 153 | getIntMinus128 | °C | Zieltemperatur Hauptauslass | 20–60 | — |
| TOP8 | Compressor_Freq | 166 | getIntMinus1 | Hz | Kompressor-Frequenz | 0–140 | — |
| TOP9 | DHW_Target_Temp | 42 | getIntMinus128 | °C | Zieltemperatur Warmwasser (DHW) | 40–75 | Ja (set_DHW_temp) |
| TOP10 | DHW_Temp | 141 | getIntMinus128 | °C | Ist-Temperatur DHW | 0–90 | — |
| TOP11 | Operations_Hours | 0 | unknown | h | Betriebsstunden Wärmepumpe | 0+ | — |
| TOP12 | Operations_Counter | 0 | unknown | count | Startzähler Wärmepumpe | 0+ | — |
| TOP13 | Main_Schedule_State | 5 | getBit1and2 | — | Zeitplan Hauptthermostat | 0=Inaktiv, 1=Aktiv | Ja (set_main_schedule) |
| TOP14 | Outside_Temp | 142 | getIntMinus128 | °C | Außentemperatur | -50–50 | — |
| TOP15 | Heat_Power_Production | 194 | getPower | Watt | Thermische Heizleistung | 0–20000 | — |
| TOP16 | Heat_Power_Consumption | 193 | getPower | Watt | Elektrische Heizleistung | 0–10000 | — |
| TOP17 | Powerful_Mode_Time | 7 | getRight3bits | min | Dauer Powerful-Modus | 0=Off, 1=30min, 2=60min, 3=90min | Ja (set_powerful_mode) |
| TOP18 | Quiet_Mode_Level | 7 | getBit3and4and5 | — | Leise-Modus-Stufe | 0=Off, 1=Level1, 2=Level2, 3=Level3 | Ja (set_quiet_mode) |
| TOP19 | Holiday_Mode_State | 5 | getBit3and4 | — | Urlaubsmodus | 0=Off, 1=Scheduled, 2=Active | Ja (set_holiday_mode) |
| TOP20 | ThreeWay_Valve_State | 111 | getBit7and8 | — | 3-Wege-Ventil-Position | 0=Room, 1=DHW | — |
| TOP21 | Outside_Pipe_Temp | 158 | getIntMinus128 | °C | Außenrohr-Temperatur | -50–50 | — |
| TOP22 | DHW_Heat_Delta | 99 | getIntMinus128 | K | DHW-Heiz-Delta | -12 bis -2 | Ja (set_dhw_heat_delta) |
| TOP23 | Heat_Delta | 84 | getIntMinus128 | K | Heiz-Delta | 0–20 | Ja (set_floor_heat_delta) |
| TOP24 | Cool_Delta | 94 | getIntMinus128 | K | Kühl-Delta | 0–20 | Ja (set_floor_cool_delta) |
| TOP25 | DHW_Holiday_Shift_Temp | 44 | getIntMinus128 | K | DHW-Urlaubsversatz | -15 bis +15 | — |
| TOP26 | Defrosting_State | 111 | getBit5and6 | — | Abtau-Status | 0=Off, 1=On | — |
| TOP27 | Z1_Heat_Request_Temp | 38 | getIntMinus128 | °C | Zone 1 Heiz-Anforderung | -5 bis 5 (Shift) oder 20+ (Direct) | Ja (set_z1_heat_request_temperature) |
| TOP28 | Z1_Cool_Request_Temp | 39 | getIntMinus128 | °C | Zone 1 Kühl-Anforderung | -5 bis 5 (Shift) oder 5–20 (Direct) | Ja (set_z1_cool_request_temperature) |
| TOP29 | Z1_Heat_Curve_Target_High_Temp | 75 | getIntMinus128 | °C | Z1 Heizkurve Target High | 20–60 | Ja (set_curves) |
| TOP30 | Z1_Heat_Curve_Target_Low_Temp | 76 | getIntMinus128 | °C | Z1 Heizkurve Target Low | 20–60 | Ja (set_curves) |
| TOP31 | Z1_Heat_Curve_Outside_High_Temp | 78 | getIntMinus128 | °C | Z1 Heizkurve Outside High | -15 bis 20 | Ja (set_curves) |
| TOP32 | Z1_Heat_Curve_Outside_Low_Temp | 77 | getIntMinus128 | °C | Z1 Heizkurve Outside Low | -15 bis 20 | Ja (set_curves) |
| TOP33 | Room_Thermostat_Temp | 156 | getIntMinus128 | °C | Raumtemperatur (Fernfühler) | 10–30 | — |
| TOP34 | Z2_Heat_Request_Temp | 40 | getIntMinus128 | °C | Zone 2 Heiz-Anforderung | -5 bis 5 oder 20+ | Ja (set_z2_heat_request_temperature) |
| TOP35 | Z2_Cool_Request_Temp | 41 | getIntMinus128 | °C | Zone 2 Kühl-Anforderung | -5 bis 5 oder 5–20 | Ja (set_z2_cool_request_temperature) |
| TOP36 | Z1_Water_Temp | 145 | getIntMinus128 | °C | Zone 1 Wasser-Auslasstemperatur | 0–60 | — |
| TOP37 | Z2_Water_Temp | 146 | getIntMinus128 | °C | Zone 2 Wasser-Auslasstemperatur | 0–60 | — |
| TOP38 | Cool_Power_Production | 196 | getPower | Watt | Thermische Kühlleistung | 0–20000 | — |
| TOP39 | Cool_Power_Consumption | 195 | getPower | Watt | Elektrische Kühlleistung | 0–10000 | — |
| TOP40 | DHW_Power_Production | 198 | getPower | Watt | Thermische DHW-Leistung | 0–15000 | — |
| TOP41 | DHW_Power_Consumption | 197 | getPower | Watt | Elektrische DHW-Leistung | 0–10000 | — |
| TOP42 | Z1_Water_Target_Temp | 147 | getIntMinus128 | °C | Zone 1 Zieltemperatur Wasser | 20–60 | — |
| TOP43 | Z2_Water_Target_Temp | 148 | getIntMinus128 | °C | Zone 2 Zieltemperatur Wasser | 20–60 | — |
| TOP44 | Error | 0 | unknown | — | Letzte Fehlermeldung | FXX, HXX oder "No error" | — |
| TOP45 | Room_Holiday_Shift_Temp | 43 | getIntMinus128 | K | Raum-Urlaubsversatz | -15 bis +15 | — |
| TOP46 | Buffer_Temp | 149 | getIntMinus128 | °C | Pufferspeicher-Temperatur | 0–90 | — |
| TOP47 | Solar_Temp | 150 | getIntMinus128 | °C | Solarkollektor-Temperatur | 0–100 | — |
| TOP48 | Pool_Temp | 151 | getIntMinus128 | °C | Pooltemperatur | 0–50 | — |
| TOP49 | Main_Hex_Outlet_Temp | 154 | getIntMinus128 | °C | Wärmeübertrager-Auslasstemperatur | -50–50 | — |
| TOP50 | Discharge_Temp | 155 | getIntMinus128 | °C | Verdichter-Auslasstemperatur | -50–100 | — |
| TOP51 | Inside_Pipe_Temp | 157 | getIntMinus128 | °C | Innenrohr-Temperatur | -50–50 | — |
| TOP52 | Defrost_Temp | 159 | getIntMinus128 | °C | Abtau-Temperatur | -20–20 | — |
| TOP53 | Eva_Outlet_Temp | 160 | getIntMinus128 | °C | Verdampfer-Auslasstemperatur | -50–20 | — |
| TOP54 | Bypass_Outlet_Temp | 161 | getIntMinus128 | °C | Bypass-Auslasstemperatur | -50–50 | — |
| TOP55 | Ipm_Temp | 162 | getIntMinus128 | °C | IPM-Temperatur (Leistungsmodul) | 0–100 | — |
| TOP56 | Z1_Temp | 139 | getIntMinus128 | °C | Zone 1 Ist-Temperatur | 0–50 | — |
| TOP57 | Z2_Temp | 140 | getIntMinus128 | °C | Zone 2 Ist-Temperatur | 0–50 | — |
| TOP58 | DHW_Heater_State | 9 | getBit5and6 | — | Backup-Heizer DHW Status | 0=Disabled, 1=Enabled | Ja (set_dhw_heater_state) |
| TOP59 | Room_Heater_State | 9 | getBit7and8 | — | Backup-Heizer Raum Status | 0=Disabled, 1=Enabled | Ja (set_room_heater_state) |
| TOP60 | Internal_Heater_State | 112 | getBit7and8 | — | Interner Heizer Status | 0=Inactive, 1=Active | — |
| TOP61 | External_Heater_State | 112 | getBit5and6 | — | Externer Heizer Status | 0=Inactive, 1=Active | — |
| TOP62 | Fan1_Motor_Speed | 173 | getIntMinus1Times10 | r/min | Lüfter 1 Drehzahl | 0–3000 | — |
| TOP63 | Fan2_Motor_Speed | 174 | getIntMinus1Times10 | r/min | Lüfter 2 Drehzahl | 0–3000 | — |
| TOP64 | High_Pressure | 163 | getIntMinus1Div5 | Kgf/cm² | Hochdruck (Verdichter) | 0–50 | — |
| TOP65 | Pump_Speed | 171 | getIntMinus1Times50 | r/min | Umwälzpumpen-Drehzahl | 0–3000 | — |
| TOP66 | Low_Pressure | 164 | getIntMinus1Times50 | Kgf/cm² | Niedrigdruck (Verdampfer) | 0–30 | — |
| TOP67 | Compressor_Current | 165 | getIntMinus1Div5 | Ampere | Verdichter-Stromaufnahme | 0–30 | — |
| TOP68 | Force_Heater_State | 5 | getBit5and6 | — | Heizer erzwingen Status | 0=Inactive, 1=Active | — |
| TOP69 | Sterilization_State | 117 | getBit5and6 | — | Sterilisierungs-Status | 0=Inactive, 1=Active | Ja (set_force_sterilization) |
| TOP70 | Sterilization_Temp | 100 | getIntMinus128 | °C | Sterilisierungs-Temperatur | 40–80 | — |
| TOP71 | Sterilization_Max_Time | 101 | getIntMinus1 | min | Max. Sterilisierungszeit | 0–240 | — |
| TOP72 | Z1_Cool_Curve_Target_High_Temp | 86 | getIntMinus128 | °C | Z1 Kühlkurve Target High | 15–50 | Ja (set_curves) |
| TOP73 | Z1_Cool_Curve_Target_Low_Temp | 87 | getIntMinus128 | °C | Z1 Kühlkurve Target Low | 10–40 | Ja (set_curves) |
| TOP74 | Z1_Cool_Curve_Outside_High_Temp | 89 | getIntMinus128 | °C | Z1 Kühlkurve Outside High | 20–35 | Ja (set_curves) |
| TOP75 | Z1_Cool_Curve_Outside_Low_Temp | 88 | getIntMinus128 | °C | Z1 Kühlkurve Outside Low | 15–30 | Ja (set_curves) |
| TOP76 | Heating_Mode | 28 | getBit7and8 | — | Heiz-Betriebsart | 0=Comp.Curve, 1=Direct | — |
| TOP77 | Heating_Off_Outdoor_Temp | 83 | getIntMinus128 | °C | Außentemp. Heizen aus | 5–35 | Ja (set_heatingoffoutdoortemp) |
| TOP78 | Heater_On_Outdoor_Temp | 85 | getIntMinus128 | °C | Außentemp. Heizer an | -15–20 | Ja (set_heater_on_outdoor_temp) |
| TOP79 | Heat_To_Cool_Temp | 95 | getIntMinus128 | °C | Auto-Umschaltung Heat→Cool | 10–30 | — |
| TOP80 | Cool_To_Heat_Temp | 96 | getIntMinus128 | °C | Auto-Umschaltung Cool→Heat | 10–30 | — |
| TOP81 | Cooling_Mode | 28 | getBit5and6 | — | Kühl-Betriebsart | 0=Comp.Curve, 1=Direct | — |
| TOP82 | Z2_Heat_Curve_Target_High_Temp | 79 | getIntMinus128 | °C | Z2 Heizkurve Target High | 20–60 | Ja (set_curves) |
| TOP83 | Z2_Heat_Curve_Target_Low_Temp | 80 | getIntMinus128 | °C | Z2 Heizkurve Target Low | 20–60 | Ja (set_curves) |
| TOP84 | Z2_Heat_Curve_Outside_High_Temp | 82 | getIntMinus128 | °C | Z2 Heizkurve Outside High | -15 bis 20 | Ja (set_curves) |
| TOP85 | Z2_Heat_Curve_Outside_Low_Temp | 81 | getIntMinus128 | °C | Z2 Heizkurve Outside Low | -15 bis 20 | Ja (set_curves) |
| TOP86 | Z2_Cool_Curve_Target_High_Temp | 90 | getIntMinus128 | °C | Z2 Kühlkurve Target High | 15–50 | Ja (set_curves) |
| TOP87 | Z2_Cool_Curve_Target_Low_Temp | 91 | getIntMinus128 | °C | Z2 Kühlkurve Target Low | 10–40 | Ja (set_curves) |
| TOP88 | Z2_Cool_Curve_Outside_High_Temp | 93 | getIntMinus128 | °C | Z2 Kühlkurve Outside High | 20–35 | Ja (set_curves) |
| TOP89 | Z2_Cool_Curve_Outside_Low_Temp | 92 | getIntMinus128 | °C | Z2 Kühlkurve Outside Low | 15–30 | Ja (set_curves) |
| TOP90 | Room_Heater_Operations_Hours | 0 | unknown | h | Betriebsstunden Backup-Heizer Raum | 0+ | — |
| TOP91 | DHW_Heater_Operations_Hours | 0 | unknown | h | Betriebsstunden Backup-Heizer DHW | 0+ | — |
| TOP92 | Heat_Pump_Model | 0 | unknown | — | Wärmepumpen-Modell-ID | HEX-String | — |
| TOP93 | Pump_Duty | 172 | getIntMinus1 | % | Umwälzpumpen-Leistung (Duty) | 0–100 | — |
| TOP94 | Zones_State | 6 | getBit1and2 | — | Zonen-Status | 0=Z1 aktiv, 1=Z2 aktiv, 2=Beide aktiv | Ja (set_zones) |
| TOP95 | Max_Pump_Duty | 45 | getIntMinus1 | % | Max. Pumpen-Duty | 0–100 | Ja (set_max_pump_duty) |
| TOP96 | Heater_Delay_Time | 104 | getIntMinus1 | min | Heizer-Verzögerungszeit | 0–255 | Ja (set_heater_delay_time) |
| TOP97 | Heater_Start_Delta | 105 | getIntMinus128 | K | Heizer-Start-Delta | -10–10 | Ja (set_heater_start_delta) |
| TOP98 | Heater_Stop_Delta | 106 | getIntMinus128 | K | Heizer-Stop-Delta | -10–10 | Ja (set_heater_stop_delta) |
| TOP99 | Buffer_Installed | 24 | getBit5and6 | — | Puffer installiert | 0=No, 1=Yes | Ja (set_buffer) |
| TOP100 | DHW_Installed | 24 | getBit7and8 | — | DHW installiert | 0=No, 1=Yes | — |
| TOP101 | Solar_Mode | 24 | getBit3and4 | — | Solarmodus | 0=Disabled, 1=To Buffer, 2=To DHW | — |
| TOP102 | Solar_On_Delta | 61 | getIntMinus128 | K | Solar Zu-Delta | 1–20 | — |
| TOP103 | Solar_Off_Delta | 62 | getIntMinus128 | K | Solar Aus-Delta | 1–20 | — |
| TOP104 | Solar_Frost_Protection | 63 | getIntMinus128 | °C | Solar Frostschutz-Temperatur | -20–0 | — |
| TOP105 | Solar_High_Limit | 64 | getIntMinus128 | °C | Solar Max-Temperatur-Limit | 40–80 | — |
| TOP106 | Pump_Flowrate_Mode | 29 | getBit3and4 | — | Pumpen-Durchflussregelmodus | 0=DeltaT, 1=Max flow | Ja (set_pump_flowrate_mode) |
| TOP107 | Liquid_Type | 20 | getBit1 | — | Flüssigkeitstyp | 0=Water, 1=Glycol | — |
| TOP108 | Alt_External_Sensor | 20 | getBit3and4 | — | Alt. Außensensor aktiv | 0=No, 1=Yes | Ja (set_alt_external_sensor) |
| TOP109 | Anti_Freeze_Mode | 20 | getBit5and6 | — | Frostschutz-Modus | 0=No, 1=Yes | — |
| TOP110 | Optional_PCB | 20 | getBit7and8 | — | Optionale PCB installiert | 0=No, 1=Yes | — |
| TOP111 | Z1_Sensor_Settings | 22 | getSecondByte | — | Z1 Sensor-Einstellung | 0=Water, 1=ExtTherm, 2=IntTherm | — |
| TOP112 | Z2_Sensor_Settings | 22 | getFirstByte | — | Z2 Sensor-Einstellung | 0=Water, 1=ExtTherm, 2=IntTherm | — |
| TOP113 | Buffer_Tank_Delta | 59 | getIntMinus128 | K | Pufferspeicher-Delta-T | 0–20 | Ja (set_buffer_delta) |
| TOP114 | External_Pad_Heater | 25 | getBit3and4 | — | Externe Heizmatte | 0=Disabled, 1=Type-A, 2=Type-B | Ja (set_external_pad_heater) |
| TOP115 | Water_Pressure | 125 | getIntMinus1Div50 | bar | Wasserdruck | 0–3 | — |
| TOP116 | Second_Inlet_Temp | 126 | getIntMinus128 | °C | Zweiter Einlass | -50–50 | — |
| TOP117 | Economizer_Outlet_Temp | 127 | getIntMinus128 | °C | Economizer-Auslass | -50–50 | — |
| TOP118 | Second_Room_Thermostat_Temp | 128 | getIntMinus128 | °C | 2. Raum-Thermostat | 10–30 | — |
| TOP119 | External_Control | 23 | getBit7and8 | — | Externe Steuerung aktiv | 0=No, 1=Yes | Ja (set_external_control) |
| TOP120 | External_Heat_Cool_Control | 23 | getBit5and6 | — | Ext. Heat/Cool-Steuerung | 0=No, 1=Yes | Ja (set_external_heat_cool_control) |
| TOP121 | External_Error_Signal | 23 | getBit3and4 | — | Externes Fehlersignal aktiv | 0=No, 1=Yes | Ja (set_external_error) |
| TOP122 | External_Compressor_Control | 23 | getBit1and2 | — | Ext. Verdichter-Steuerung | 0=No, 1=Yes | Ja (set_external_compressor_control) |
| TOP123 | Z1_Pump_State | 116 | getBit1and2 | — | Zone 1 Pump Status | 0=Off, 1=On | — |
| TOP124 | Z2_Pump_State | 116 | getBit3and4 | — | Zone 2 Pump Status | 0=Off, 1=On | — |
| TOP125 | TwoWay_Valve_State | 116 | getBit5and6 | — | 2-Wege-Ventil | 0=Cool, 1=Heat | — |
| TOP126 | ThreeWay_Valve_State2 | 116 | getBit7and8 | — | 3-Wege-Ventil (2. Def.) | 0=Room, 1=DHW | — |
| TOP127 | Z1_Valve_PID | 177 | getValvePID | % | Z1 Mischventil PID-Wert | 0–100 | — |
| TOP128 | Z2_Valve_PID | 178 | getValvePID | % | Z2 Mischventil PID-Wert | 0–100 | — |
| TOP129 | Bivalent_Control | 26 | getBit7and8 | — | Bivalent-Steuerung | 0=Disabled, 1=Enabled | Ja (set_bivalent_control) |
| TOP130 | Bivalent_Mode | 26 | getBit5and6 | — | Bivalent-Modus | 0=Alternative, 1=Parallel, 2=Adv.Par | Ja (set_bivalent_mode) |
| TOP131 | Bivalent_Start_Temp | 65 | getIntMinus128 | °C | Bivalent-Start-Temperatur | -15–35 | Ja (set_bivalent_start_temp) |
| TOP132 | Bivalent_Advanced_Heat | 26 | getBit3and4 | — | Bivalent Adv. Heizen | 0=Disabled, 1=Enabled | — |
| TOP133 | Bivalent_Advanced_DHW | 26 | getBit1and2 | — | Bivalent Adv. DHW | 0=Disabled, 1=Enabled | — |
| TOP134 | Bivalent_Advanced_Start_Temp | 66 | getIntMinus128 | °C | Bivalent Adv. Start-Temp | -15–35 | Ja (set_bivalent_ap_start_temp) |
| TOP135 | Bivalent_Advanced_Stop_Temp | 68 | getIntMinus128 | °C | Bivalent Adv. Stop-Temp | -15–35 | Ja (set_bivalent_ap_stop_temp) |
| TOP136 | Bivalent_Advanced_Start_Delay | 67 | getIntMinus1 | min | Bivalent Adv. Start-Verzögerung | 0–255 | — |
| TOP137 | Bivalent_Advanced_Stop_Delay | 69 | getIntMinus1 | min | Bivalent Adv. Stop-Verzögerung | 0–255 | — |
| TOP138 | Bivalent_Advanced_DHW_Delay | 70 | getIntMinus1 | min | Bivalent Adv. DHW-Verzögerung | 0–255 | — |
| TOP139 | Heating_Control | 30 | getBit5and6 | — | Heiz-Regelung | 0=Comfort, 1=Efficiency | Ja (set_heatingcontrol) |
| TOP140 | Smart_DHW | 24 | getBit1and2 | — | Smart DHW | 0=Variable, 1=Standard | Ja (set_smart_dhw) |
| TOP141 | Quiet_Mode_Priority | 11 | getBit3and4 | — | Leise-Modus-Priorität | 0=Sound, 1=Capacity | Ja (set_quiet_mode_priority) |
| TOP142 | Expansion_Valve | 175 | getIntMinus1 | Steps | Expansionsventil-Stellung | 0–255 | — |
| TOP143 | DHW_Sensor_Selection | 11 | getBit7and8 | — | DHW-Sensor-Auswahl | 0=Top, 1=Center | Ja (set_dhw_sensor_selection) |

---

## Tabelle 2: Optional-PCB-Datenpunkte (OPT0–OPT6)

Diese Datenpunkte repräsentieren die Steuerausgänge der optionalen PCB (Zubehörplatine). Sie werden aus Bit-Feldern des Optionalen-PCB-Response-Frames (Bytes 4–5) extrahiert.

| ID | Name | Byte | Bit-Maske | Einheit | Beschreibung | Werte | Schreibbar |
|:---|:---|:---:|:---|:---|:---|:---|:---|
| OPT0 | Z1_Water_Pump | 4 | Bit 7 | — | Zone 1 Umwälzpumpe | 0=Off, 1=On | ? |
| OPT1 | Z1_Mixing_Valve | 4 | Bits 5–6 | — | Zone 1 Mischventil | 0=Off, 1=Decrease, 2=Increase, 3=Invalid | ? |
| OPT2 | Z2_Water_Pump | 4 | Bit 4 | — | Zone 2 Umwälzpumpe | 0=Off, 1=On | ? |
| OPT3 | Z2_Mixing_Valve | 4 | Bits 2–3 | — | Zone 2 Mischventil | 0=Off, 1=Decrease, 2=Increase, 3=Invalid | ? |
| OPT4 | Pool_Water_Pump | 4 | Bit 1 | — | Pool-Umwälzpumpe | 0=Off, 1=On | ? |
| OPT5 | Solar_Water_Pump | 4 | Bit 0 | — | Solar-Umwälzpumpe | 0=Off, 1=On | ? |
| OPT6 | Alarm_State | 5 | Bit 0 | — | Alarm-Status | 0=Off, 1=On | ? |

---

## Tabelle 3: Extra-16-Bit-Datenpunkte (XTOP0–XTOP5)

Diese Datenpunkte sind 16-Bit-Werte aus zwei aufeinanderfolgenden Bytes des 203-Byte-Frames.

| ID | Name | Bytes | Decoder | Einheit | Beschreibung | Range | Schreibbar |
|:---|:---|:---:|:---|:---|:---|:---|:---|
| XTOP0 | Heat_Power_Consumption_Extra | 14–15 | getUintt16 | Watt | Zusätzliche Heizleistungs-Daten | 0–65534 | Nein |
| XTOP1 | Cool_Power_Consumption_Extra | 16–17 | getUintt16 | Watt | Zusätzliche Kühlleistungs-Daten | 0–65534 | Nein |
| XTOP2 | DHW_Power_Consumption_Extra | 18–19 | getUintt16 | Watt | Zusätzliche DHW-Leistungs-Daten | 0–65534 | Nein |
| XTOP3 | Heat_Power_Production_Extra | 20–21 | getUintt16 | Watt | Zusätzliche Heizproduktions-Daten | 0–65534 | Nein |
| XTOP4 | Cool_Power_Production_Extra | 22–23 | getUintt16 | Watt | Zusätzliche Kühlproduktions-Daten | 0–65534 | Nein |
| XTOP5 | DHW_Power_Production_Extra | 24–25 | getUintt16 | Watt | Zusätzliche DHW-Produktions-Daten | 0–65534 | Nein |

---

## Zusammenfassung

- **Haupt-Datenpunkte:** 144 (TOP0–TOP143)
- **Optional-PCB:** 7 (OPT0–OPT6)
- **Extra 16-Bit:** 6 (XTOP0–XTOP5)
- **Insgesamt:** 157 Datenpunkte

### Spezielle Hinweise

1. **Spezialfall-Decoder (Offset 0, Funktion `unknown`):** TOP1 (Pump_Flow), TOP11 (Operations_Hours), TOP12 (Operations_Counter), TOP44 (Error), TOP90 (Room_Heater_Operations_Hours), TOP91 (DHW_Heater_Operations_Hours), TOP92 (Heat_Pump_Model). Diese werden in [decode.cpp:158 — `getDataValue()`](../../vendor/heishamon-upstream/HeishaMon/decode.cpp#L158) per Switch-Case auf Spezialfunktionen umgeleitet (z.B. `getPumpFlow()`, `getErrorInfo()`, 32-Bit-Composition aus mehreren Bytes). Phase 1 muss diese Spezialfälle einzeln implementieren.
2. **Schreibbare Datenpunkte:** **59 Topics** haben eine zugehörige `set_*`-Funktion in [commands.cpp](../../vendor/heishamon-upstream/HeishaMon/commands.cpp). Diese Datenpunkte werden im ioBroker-Adapter als `common.write: true` angelegt.
3. **Unklare Schreibbarkeit:** Einige Topics sind in der Tabelle mit `?` markiert — entweder weil die `set_*`-Funktion nicht eindeutig zuzuordnen war oder weil das Topic über `set_curves` o.ä. mit anderen Topics gebündelt wird. In Phase 1 nochmal gegen [commands.h](../../vendor/heishamon-upstream/HeishaMon/commands.h) prüfen.
4. **OPT-Datenpunkte:** Werden nicht über `topicFunctions[]`-Array dekodiert, sondern direkt per Bit-Maskierung in `getOptDataValue()` ([decode.cpp](../../vendor/heishamon-upstream/HeishaMon/decode.cpp)). In Phase 1 als kleine Sammlung von Bit-Extraktoren implementieren.

### Quellen

- Haupt-Daten: [decode.h](../../vendor/heishamon-upstream/HeishaMon/decode.h) (Arrays `topics[]`, `topicBytes[]`, `topicFunctions[]`)
- Beschreibungen: [MQTT-Topics.md](../../vendor/heishamon-upstream/MQTT-Topics.md)
- Schreibbare Commands: [commands.cpp](../../vendor/heishamon-upstream/HeishaMon/commands.cpp), [commands.h](../../vendor/heishamon-upstream/HeishaMon/commands.h)
- Decoder-Funktionen: [decode.cpp](../../vendor/heishamon-upstream/HeishaMon/decode.cpp)

---

**Stand:** 2026-05-23, basierend auf HeishaMon-Snapshot `7b031e8` ([UPSTREAM.md](../../vendor/heishamon-upstream/UPSTREAM.md))
