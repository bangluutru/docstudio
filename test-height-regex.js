const htmlInput = '<div class="h-64 min-h-[200px] h-screen h-10">...</div>';
const scale = ['0', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '5', '6', '7', '8', '9', '10', '11', '12', '14', '16', '20', '24', '28', '32', '36', '40', '44', '48', '52', '56', '60', '64', '72', '80', '96'];

let res = htmlInput.replace(/\b(min-h-|h-)(\d+|1\.5|2\.5|3\.5)\b/g, (match, prefix, val) => {
    const idx = scale.indexOf(val);
    if (idx > 1) return prefix + scale[Math.max(1, idx - 3)];
    return match;
}).replace(/\b(min-h-|h-)\[(\d+)px\]\b/g, (match, prefix, val) => {
    const px = parseInt(val, 10);
    return `${prefix}[${Math.max(4, px - 16)}px]`;
}).replace(/\b(min-h-|h-)(screen|full)\b/g, '$1auto');

console.log(res);
