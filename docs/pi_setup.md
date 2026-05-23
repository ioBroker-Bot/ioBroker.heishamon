# Using GPIO0 (Pin27) as TXD2 and GPIO1 (Pin28) as RXD2 (by default this pins are used for HAT-I2C-EEPROM)

rpdom@raspberrypi:~ $ tail -5 /boot/config.txt

# Enable uart2 on GPIO 0 and 1, Pins 27, 28
disable_poe_fan=1
force_eeprom_read=0
dtoverlay=uart2

# Check config
rpdom@raspberrypi:~ $ raspi-gpio get 0-1
GPIO 0: level=1 fsel=3 alt=4 func=TXD2 pull=NONE
GPIO 1: level=1 fsel=3 alt=4 func=RXD2 pull=UP
