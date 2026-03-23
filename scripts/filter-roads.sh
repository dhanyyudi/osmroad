#!/bin/bash
# Filter OSM PBF files to keep only roads (highway tag)
# Usage: ./filter-roads.sh [input.pbf] [output.pbf]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if osmium is installed
if ! command -v osmium &> /dev/null; then
    print_error "osmium not found. Please install osmium-tool:"
    echo "  macOS: brew install osmium-tool"
    echo "  Ubuntu: sudo apt-get install osmium-tool"
    echo "  Or build from source: https://osmcode.org/osmium-tool/"
    exit 1
fi

# Check arguments
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 [input.pbf] [output.pbf]"
    echo "Example: $0 pbf/bali-island.osm.pbf public/samples/bali-island-roads.osm.pbf"
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="$2"

# Check if input file exists
if [ ! -f "$INPUT_FILE" ]; then
    print_error "Input file not found: $INPUT_FILE"
    exit 1
fi

# Create output directory if not exists
OUTPUT_DIR=$(dirname "$OUTPUT_FILE")
mkdir -p "$OUTPUT_DIR"

print_info "Filtering roads from: $INPUT_FILE"
print_info "Output will be saved to: $OUTPUT_FILE"

# Get initial file size
INPUT_SIZE=$(stat -f%z "$INPUT_FILE" 2>/dev/null || stat -c%s "$INPUT_FILE" 2>/dev/null)
INPUT_SIZE_MB=$((INPUT_SIZE / 1024 / 1024))
print_info "Input file size: ${INPUT_SIZE_MB}MB"

# Filter: Keep only ways with highway tag and their referenced nodes
# Strategy:
# 1. First extract all ways with highway tag
# 2. Then extract all nodes referenced by those ways
# 3. Merge them together

TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

print_info "Step 1/3: Extracting ways with highway tag..."
osmium tags-filter "$INPUT_FILE" "w/highway" -o "$TEMP_DIR/roads_only.pbf" --overwrite

print_info "Step 2/3: Extracting referenced nodes..."
osmium extract -p "$TEMP_DIR/roads_only.pbf" "$INPUT_FILE" -o "$TEMP_DIR/nodes.pbf" --overwrite

print_info "Step 3/3: Merging roads and nodes..."
osmium merge "$TEMP_DIR/roads_only.pbf" "$TEMP_DIR/nodes.pbf" -o "$OUTPUT_FILE" --overwrite

# Get output file size
OUTPUT_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null)
OUTPUT_SIZE_MB=$((OUTPUT_SIZE / 1024 / 1024))

# Calculate reduction
REDUCTION=$((100 - (OUTPUT_SIZE * 100 / INPUT_SIZE)))

print_info "Filtering complete!"
print_info "Output file size: ${OUTPUT_SIZE_MB}MB (${REDUCTION}% reduction)"

# Verify output
if [ -f "$OUTPUT_FILE" ]; then
    print_info "Verifying output file..."
    osmium fileinfo "$OUTPUT_FILE" | head -20
else
    print_error "Output file was not created!"
    exit 1
fi

print_info "Success! Filtered file saved to: $OUTPUT_FILE"
