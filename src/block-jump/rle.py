import sys

class RLE:
    in_run = False
    run_count = 0
    byte_value = 0
    out = bytearray()

    def encode(self, data: bytearray):
        for byte_value in data:
            if not self.in_run:
                self.new_run(byte_value)
            else:
                if byte_value == self.byte_value:
                    # We can only encode a run of 255, so finish this run and start a new one
                    if self.run_count == 0xff:
                        self.commit_run()
                        self.new_run(byte_value)
                    else:
                        self.run_count += 1
                else:
                    # We have a new byte, commit the previous run and start a new one
                    self.commit_run()
                    self.new_run(byte_value)

        if self.in_run:
            self.commit_run()

        return self.out

    def new_run(self, byte_value: int):
        self.byte_value = byte_value
        self.in_run = True
        self.run_count = 1

    def commit_run(self):
        if self.run_count == 1:
            self.out.append(self.byte_value)
        else:
            self.out.append(0x80 | self.byte_value)
            self.out.append(self.run_count)
        self.in_run = False

def print_usage_and_exit():
    print("usage: rle.py <input file> <output file>")
    exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print_usage_and_exit()

    infile = sys.argv[1]
    outfile = sys.argv[2]

    with open(infile, "rb") as f:
        file_bytes = bytearray(f.read())

    rle = RLE()
    out_bytes = rle.encode(file_bytes)

    with open(outfile, "wb") as f:
        f.write(out_bytes)
