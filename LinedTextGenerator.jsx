/**
 * LinedTextGenerator.jsx
 * Adobe Illustrator ExtendScript with Live Preview
 * 
 * Converts text or vector shapes into horizontal striped/ribbed lines with round caps
 * following letter contours (scanline / retro lined text effect).
 * 
 * Copyright (c) Typepot.com / Dikavanuki Studio. All rights reserved.
 */

#target illustrator

(function () {
    if (app.documents.length === 0) {
        alert("Please open an Illustrator document and select text or vector artwork first!");
        return;
    }

    var doc = app.activeDocument;
    var sel = doc.selection;

    if (!sel || sel.length === 0) {
        alert("Please select text or a vector object before running the script!");
        return;
    }

    // --- PRE-PROCESSING GEOMETRY (CACHED FOR ULTRA-FAST LIVE PREVIEW) ---
    var originalItems = [];
    for (var i = 0; i < sel.length; i++) {
        originalItems.push(sel[i]);
    }

    var sampledColor = null;
    var targetShapes = [];

    for (var j = 0; j < originalItems.length; j++) {
        var item = originalItems[j];
        if (item.typename === "TextFrame") {
            var dup = item.duplicate();
            var outlined = dup.createOutline();
            targetShapes.push(outlined);
            if (!sampledColor && item.textRange && item.textRange.characterAttributes) {
                sampledColor = item.textRange.characterAttributes.fillColor;
            }
        } else {
            var dupVect = item.duplicate();
            targetShapes.push(dupVect);
            if (!sampledColor) {
                sampledColor = extractFillColor(item);
            }
        }
    }

    // Calculate overall bounding box
    var overallBounds = getOverallBounds(targetShapes);
    var left = overallBounds[0];
    var top = overallBounds[1];
    var right = overallBounds[2];
    var bottom = overallBounds[3];
    var totalHeight = top - bottom;

    if (totalHeight <= 0) {
        alert("Invalid object dimensions.");
        for (var c = 0; c < targetShapes.length; c++) {
            try { targetShapes[c].remove(); } catch (e) { }
        }
        return;
    }

    // Flatten all glyphs into individual CompoundPathItems or PathItems
    var glyphObjects = [];
    for (var k = 0; k < targetShapes.length; k++) {
        extractGlyphs(targetShapes[k], glyphObjects);
    }

    // Cache Bezier segments directly in JavaScript memory
    var allGlyphsData = [];
    for (var gIdx = 0; gIdx < glyphObjects.length; gIdx++) {
        var segs = extractSegmentsFromGlyph(glyphObjects[gIdx]);
        if (segs.length > 0) {
            allGlyphsData.push(segs);
        }
    }

    // Remove temporary duplicate objects immediately after caching
    for (var rem = 0; rem < targetShapes.length; rem++) {
        try { targetShapes[rem].remove(); } catch (e) { }
    }

    // Active preview group handle
    var previewGroup = null;

    // --- SCRIPTUI DIALOG WITH LIVE PREVIEW ---
    var dlg = new Window("dialog", "Lined Text Generator");
    dlg.orientation = "column";
    dlg.alignChildren = ["fill", "top"];
    dlg.preferredWidth = 350;

    // Line Settings Panel
    var pnlSettings = dlg.add("panel", undefined, "Line Settings");
    pnlSettings.orientation = "column";
    pnlSettings.alignChildren = ["fill", "top"];
    pnlSettings.spacing = 10;

    // Number of Lines
    var grpCount = pnlSettings.add("group");
    grpCount.add("statictext", undefined, "Line Count:");
    var sldCount = grpCount.add("slider", undefined, 18, 5, 80);
    var txtCount = grpCount.add("edittext", undefined, "18");
    txtCount.characters = 3;

    // Stroke Weight
    var grpWeight = pnlSettings.add("group");
    grpWeight.add("statictext", undefined, "Stroke Weight (pt):");
    var sldWeight = grpWeight.add("slider", undefined, 6, 1, 30);
    var txtWeight = grpWeight.add("edittext", undefined, "6");
    txtWeight.characters = 3;

    // Stroke Cap Style
    var grpCap = pnlSettings.add("group");
    grpCap.add("statictext", undefined, "Cap Style:");
    var dropCap = grpCap.add("dropdownlist", undefined, [
        "Round Cap (Sample Style)",
        "Butt Cap (Flat)",
        "Projecting Cap (Square)"
    ]);
    dropCap.selection = 0;

    // Color Options
    var grpColor = pnlSettings.add("group");
    grpColor.add("statictext", undefined, "Line Color:");
    var dropColor = grpColor.add("dropdownlist", undefined, [
        "Pink / Magenta (Sample)",
        "Match Original Text Color",
        "Solid Black"
    ]);
    dropColor.selection = 0;

    // Preview & Output Options Panel
    var pnlExtra = dlg.add("panel", undefined, "Preview & Options");
    pnlExtra.orientation = "column";
    pnlExtra.alignChildren = ["fill", "top"];

    var chkPreview = pnlExtra.add("checkbox", undefined, "Enable Live Preview");
    chkPreview.value = true;

    var chkHideOriginal = pnlExtra.add("checkbox", undefined, "Hide original text / object when done");
    chkHideOriginal.value = true;

    // Action Buttons
    var grpButtons = dlg.add("group");
    grpButtons.alignment = ["center", "top"];
    var btnCancel = grpButtons.add("button", undefined, "Cancel", { name: "cancel" });
    var btnOK = grpButtons.add("button", undefined, "Apply", { name: "ok" });

    // Copyright Footer
    var lblCopyright = dlg.add("statictext", undefined, "\u00A9 Typepot.com / Dikavanuki Studio");
    lblCopyright.alignment = ["center", "bottom"];

    // --- INTERACTIVE EVENT HANDLERS ---

    function getCurrentSettings() {
        return {
            lineCount: Math.round(sldCount.value),
            strokeW: parseFloat(txtWeight.text) || 6,
            strokeCap: getSelectedStrokeCap(dropCap.selection.index),
            strokeColor: getSelectedStrokeColor(dropColor.selection.index, doc, sampledColor)
        };
    }

    function removePreview() {
        if (previewGroup) {
            try { previewGroup.remove(); } catch (e) { }
            previewGroup = null;
        }
        for (var o = 0; o < originalItems.length; o++) {
            try { originalItems[o].hidden = false; } catch (e) { }
        }
    }

    function updatePreview() {
        if (!chkPreview.value) {
            removePreview();
            app.redraw();
            return;
        }

        // Remove existing preview group
        if (previewGroup) {
            try { previewGroup.remove(); } catch (e) { }
            previewGroup = null;
        }

        // Hide original items while previewing to view lines clearly
        for (var o = 0; o < originalItems.length; o++) {
            try { originalItems[o].hidden = true; } catch (e) { }
        }

        previewGroup = doc.activeLayer.groupItems.add();
        previewGroup.name = "Lined Text (Live Preview)";

        var cfg = getCurrentSettings();
        generateLinesIntoGroup(previewGroup, cfg.lineCount, cfg.strokeW, cfg.strokeCap, cfg.strokeColor);

        app.redraw();
    }

    // Slider & EditText synchronization with real-time preview update
    sldCount.onChanging = function () {
        txtCount.text = Math.round(sldCount.value);
        updatePreview();
    };
    txtCount.onChange = function () {
        var val = parseInt(txtCount.text, 10);
        if (!isNaN(val)) sldCount.value = Math.max(5, Math.min(80, val));
        updatePreview();
    };

    sldWeight.onChanging = function () {
        txtWeight.text = (Math.round(sldWeight.value * 10) / 10);
        updatePreview();
    };
    txtWeight.onChange = function () {
        var val = parseFloat(txtWeight.text);
        if (!isNaN(val)) sldWeight.value = Math.max(1, Math.min(30, val));
        updatePreview();
    };

    dropCap.onChange = function () { updatePreview(); };
    dropColor.onChange = function () { updatePreview(); };
    chkPreview.onClick = function () { updatePreview(); };

    btnCancel.onClick = function () {
        removePreview();
        app.redraw();
        dlg.close(0);
    };

    btnOK.onClick = function () {
        dlg.close(1);
    };

    // Trigger initial preview when dialog appears
    dlg.onShow = function () {
        updatePreview();
    };

    var dialogResult = dlg.show();

    // --- FINALIZATION ---
    if (dialogResult === 1) {
        // User clicked Apply / OK
        if (!previewGroup) {
            previewGroup = doc.activeLayer.groupItems.add();
            var cfg = getCurrentSettings();
            generateLinesIntoGroup(previewGroup, cfg.lineCount, cfg.strokeW, cfg.strokeCap, cfg.strokeColor);
        }

        previewGroup.name = "Lined Text Effect";

        var hideOrig = chkHideOriginal.value;
        for (var h = 0; h < originalItems.length; h++) {
            originalItems[h].hidden = hideOrig;
        }

        doc.selection = [previewGroup];
        app.redraw();
    } else {
        // User clicked Cancel or closed dialog (Esc)
        removePreview();
        app.redraw();
    }

    // ==========================================
    // GEOMETRIC LINE GENERATION USING CACHE
    // ==========================================

    function generateLinesIntoGroup(group, lineCount, strokeW, strokeCap, strokeColor) {
        var stepY = totalHeight / lineCount;

        for (var lineIdx = 0; lineIdx < lineCount; lineIdx++) {
            var targetY = top - (lineIdx + 0.5) * stepY;

            for (var g = 0; g < allGlyphsData.length; g++) {
                var segments = allGlyphsData[g];

                // Slightly nudge Y away from exact anchor points to avoid vertex singularities
                var safeLineY = targetY;
                for (var s = 0; s < segments.length; s++) {
                    if (Math.abs(safeLineY - segments[s].p0[1]) < 0.05) safeLineY += 0.06;
                    if (Math.abs(safeLineY - segments[s].p3[1]) < 0.05) safeLineY += 0.06;
                }

                var xHits = [];
                for (var segIdx = 0; segIdx < segments.length; segIdx++) {
                    findIntersections(segments[segIdx], safeLineY, xHits);
                }

                if (xHits.length < 2) continue;

                // Sort X coordinates from left to right
                xHits.sort(function (a, b) { return a - b; });

                // Deduplicate consecutive hits that are virtually identical
                var cleanX = [xHits[0]];
                for (var xIdx = 1; xIdx < xHits.length; xIdx++) {
                    if (xHits[xIdx] - cleanX[cleanX.length - 1] > 0.001) {
                        cleanX.push(xHits[xIdx]);
                    }
                }

                // Pair intersection coordinates: (x0, x1), (x2, x3) -> inside letter body
                for (var pair = 0; pair < cleanX.length - 1; pair += 2) {
                    var xStart = cleanX[pair];
                    var xEnd = cleanX[pair + 1];

                    if (xEnd - xStart < 0.5) continue; // Ignore microscopic specks

                    var linePath = group.pathItems.add();
                    linePath.setEntirePath([
                        [xStart, safeLineY],
                        [xEnd, safeLineY]
                    ]);
                    linePath.stroked = true;
                    linePath.strokeWidth = strokeW;
                    linePath.strokeCap = strokeCap;
                    linePath.strokeColor = strokeColor;
                    linePath.filled = false;
                }
            }
        }
    }

    // ==========================================
    // BEZIER MATHEMATICS & INTERSECTION SOLVER
    // ==========================================

    function cbrt(val) {
        return val < 0 ? -Math.pow(-val, 1 / 3) : Math.pow(val, 1 / 3);
    }

    function solveCubic(A, B, C, D) {
        var roots = [];
        var TOL = 1e-9;

        if (Math.abs(A) < TOL) {
            // Quadratic: B t^2 + C t + D = 0
            if (Math.abs(B) < TOL) {
                // Linear: C t + D = 0
                if (Math.abs(C) > TOL) {
                    var tLin = -D / C;
                    if (tLin >= 0 && tLin <= 1) roots.push(tLin);
                }
                return roots;
            }
            var disc = C * C - 4 * B * D;
            if (disc >= 0) {
                var sqrtDisc = Math.sqrt(Math.max(0, disc));
                var t1 = (-C + sqrtDisc) / (2 * B);
                var t2 = (-C - sqrtDisc) / (2 * B);
                if (t1 >= 0 && t1 <= 1) roots.push(t1);
                if (t2 >= 0 && t2 <= 1 && Math.abs(t2 - t1) > TOL) roots.push(t2);
            }
            return roots;
        }

        // Standard Cubic: t^3 + a t^2 + b t + c = 0
        var a = B / A;
        var b = C / A;
        var c = D / A;

        var a3 = a / 3.0;
        var p = b - a * a3;
        var q = (2.0 * a * a * a) / 27.0 - (a * b) / 3.0 + c;

        var p3 = p / 3.0;
        var q2 = q / 2.0;
        var d = q2 * q2 + p3 * p3 * p3;

        if (d > TOL) {
            var sqrtD = Math.sqrt(d);
            var u = cbrt(-q2 + sqrtD);
            var v = cbrt(-q2 - sqrtD);
            var t = u + v - a3;
            if (t >= -1e-6 && t <= 1 + 1e-6) roots.push(Math.max(0, Math.min(1, t)));
        } else if (Math.abs(d) <= TOL) {
            var uEqual = cbrt(-q2);
            var r1 = 2.0 * uEqual - a3;
            var r2 = -uEqual - a3;
            if (r1 >= -1e-6 && r1 <= 1 + 1e-6) roots.push(Math.max(0, Math.min(1, r1)));
            if (r2 >= -1e-6 && r2 <= 1 + 1e-6 && Math.abs(r2 - r1) > 1e-5) roots.push(Math.max(0, Math.min(1, r2)));
        } else {
            var r = Math.sqrt(-p3 * p3 * p3);
            var phi = Math.acos(Math.max(-1, Math.min(1, -q2 / r)));
            var m = 2.0 * Math.sqrt(-p3);
            var rt1 = m * Math.cos(phi / 3.0) - a3;
            var rt2 = m * Math.cos((phi + 2.0 * Math.PI) / 3.0) - a3;
            var rt3 = m * Math.cos((phi + 4.0 * Math.PI) / 3.0) - a3;

            if (rt1 >= -1e-6 && rt1 <= 1 + 1e-6) roots.push(Math.max(0, Math.min(1, rt1)));
            if (rt2 >= -1e-6 && rt2 <= 1 + 1e-6) roots.push(Math.max(0, Math.min(1, rt2)));
            if (rt3 >= -1e-6 && rt3 <= 1 + 1e-6) roots.push(Math.max(0, Math.min(1, rt3)));
        }

        return roots;
    }

    function evalBezier1D(c0, c1, c2, c3, t) {
        return c0 + t * (c1 + t * (c2 + t * c3));
    }

    function findIntersections(seg, Y, outX) {
        var p0y = seg.p0[1];
        var p1y = seg.p1[1];
        var p2y = seg.p2[1];
        var p3y = seg.p3[1];

        // Fast bounding-box check
        var minY = Math.min(p0y, Math.min(p1y, Math.min(p2y, p3y)));
        var maxY = Math.max(p0y, Math.max(p1y, Math.max(p2y, p3y)));
        if (Y < minY || Y > maxY) return;

        var cy0 = p0y;
        var cy1 = 3.0 * (p1y - p0y);
        var cy2 = 3.0 * (p2y - 2.0 * p1y + p0y);
        var cy3 = p3y - 3.0 * p2y + 3.0 * p1y - p0y;

        var roots = solveCubic(cy3, cy2, cy1, cy0 - Y);

        var p0x = seg.p0[0];
        var p1x = seg.p1[0];
        var p2x = seg.p2[0];
        var p3x = seg.p3[0];
        var cx0 = p0x;
        var cx1 = 3.0 * (p1x - p0x);
        var cx2 = 3.0 * (p2x - 2.0 * p1x + p0x);
        var cx3 = p3x - 3.0 * p2x + 3.0 * p1x - p0x;

        for (var i = 0; i < roots.length; i++) {
            var t = roots[i];
            var eps = 0.002;
            var tBefore = Math.max(0, t - eps);
            var tAfter = Math.min(1, t + eps);
            var yBefore = evalBezier1D(cy0, cy1, cy2, cy3, tBefore);
            var yAfter = evalBezier1D(cy0, cy1, cy2, cy3, tAfter);

            if ((yBefore - Y) * (yAfter - Y) < 0) {
                var xVal = evalBezier1D(cx0, cx1, cx2, cx3, t);
                outX.push(xVal);
            }
        }
    }

    // ==========================================
    // SEGMENT EXTRACTION & HELPERS
    // ==========================================

    function extractSegmentsFromGlyph(item) {
        var paths = [];
        if (item.typename === "PathItem") {
            paths.push(item);
        } else if (item.typename === "CompoundPathItem") {
            for (var p = 0; p < item.pathItems.length; p++) {
                paths.push(item.pathItems[p]);
            }
        }

        var segments = [];
        for (var i = 0; i < paths.length; i++) {
            var path = paths[i];
            var pts = path.pathPoints;
            var len = pts.length;
            if (len < 2) continue;

            for (var j = 0; j < len; j++) {
                var nextIdx = (j + 1) % len;
                if (!path.closed && j === len - 1) break;

                segments.push({
                    p0: pts[j].anchor,
                    p1: pts[j].rightDirection,
                    p2: pts[nextIdx].leftDirection,
                    p3: pts[nextIdx].anchor
                });
            }
        }
        return segments;
    }

    function extractGlyphs(item, outList) {
        if (item.typename === "PathItem" || item.typename === "CompoundPathItem") {
            outList.push(item);
        } else if (item.typename === "GroupItem") {
            for (var i = 0; i < item.pageItems.length; i++) {
                extractGlyphs(item.pageItems[i], outList);
            }
        }
    }

    function extractFillColor(item) {
        if (item.typename === "PathItem" && item.filled) {
            return item.fillColor;
        } else if (item.typename === "CompoundPathItem" && item.pathItems.length > 0) {
            return extractFillColor(item.pathItems[0]);
        } else if (item.typename === "GroupItem" && item.pageItems.length > 0) {
            return extractFillColor(item.pageItems[0]);
        }
        return null;
    }

    function getOverallBounds(items) {
        var minL = Infinity, maxT = -Infinity, maxR = -Infinity, minB = Infinity;
        for (var i = 0; i < items.length; i++) {
            var b = items[i].geometricBounds;
            if (b[0] < minL) minL = b[0];
            if (b[1] > maxT) maxT = b[1];
            if (b[2] > maxR) maxR = b[2];
            if (b[3] < minB) minB = b[3];
        }
        return [minL, maxT, maxR, minB];
    }

    function getSelectedStrokeCap(capIndex) {
        if (capIndex === 0) return StrokeCap.ROUNDENDCAP;
        if (capIndex === 1) return StrokeCap.BUTTENDCAP;
        return StrokeCap.PROJECTINGENDCAP;
    }

    function getSelectedStrokeColor(colorMode, doc, sampledColor) {
        if (colorMode === 0) {
            if (doc.documentColorSpace === DocumentColorSpace.RGB) {
                var rgb = new RGBColor();
                rgb.red = 230; rgb.green = 0; rgb.blue = 126;
                return rgb;
            } else {
                var cmyk = new CMYKColor();
                cmyk.cyan = 0; cmyk.magenta = 100; cmyk.yellow = 20; cmyk.black = 0;
                return cmyk;
            }
        } else if (colorMode === 1 && sampledColor) {
            return sampledColor;
        } else {
            if (doc.documentColorSpace === DocumentColorSpace.RGB) {
                var blkRgb = new RGBColor();
                blkRgb.red = 0; blkRgb.green = 0; blkRgb.blue = 0;
                return blkRgb;
            } else {
                var blkCmyk = new CMYKColor();
                blkCmyk.cyan = 0; blkCmyk.magenta = 0; blkCmyk.yellow = 0; blkCmyk.black = 100;
                return blkCmyk;
            }
        }
    }
})();
