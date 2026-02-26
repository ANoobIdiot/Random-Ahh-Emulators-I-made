CC = gcc
CFLAGS = -Wall -Wextra -O2
TARGET = chip8
SOURCES = main.c chip8.c
HEADERS = chip8.h

$(TARGET): $(SOURCES) $(HEADERS)
	$(CC) $(CFLAGS) -o $(TARGET) $(SOURCES)

clean:
	rm -f $(TARGET)

run: $(TARGET)
	./$(TARGET) roms/ibm.ch8

.PHONY: clean run