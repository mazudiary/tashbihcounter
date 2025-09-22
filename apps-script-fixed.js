/**
 * Apps Script backend for Tasbih Tracker
 * Sheets expected:
 *  - user           (columns: UserID | Name | Password)
 *  - tashbih_data   (columns: Timestamp | UserID | Name | TasbihName | Count)
 *
 * Deploy as Web App (Anyone with link).
 */

function doPost(e) {
  try {
    // Check if e (event) parameter exists
    if (!e) {
      return jsonResponse({
        success: false,
        message: "No event parameter received",
        error: "Event parameter is undefined",
      });
    }

    // ensure we can parse parameters
    var params = e.parameter || {};
    var action = params.action || "";

    // Log the received data for debugging (remove in production)
    console.log("Received request:", {
      parameters: params,
      action: action,
      postData: e.postData,
    });

    // Handle ping/test requests first (before checking sheets)
    if (action === "ping" || action === "test") {
      return jsonResponse({
        success: true,
        message: "Apps Script is working!",
        timestamp: new Date().toISOString(),
        action: action,
        receivedParams: params,
      });
    }

    // IMPORTANT: Replace this with your actual Google Sheet ID
    var SHEET_ID = "1RzA6SLpNZF7sg37woS5NUzZZT6jUKeFC23pNCoPE0d4";

    var ss = SpreadsheetApp.openById(SHEET_ID);
    var userSheet = ss.getSheetByName("user");
    var dataSheet = ss.getSheetByName("tashbih_data");

    if (!userSheet || !dataSheet) {
      return jsonResponse({
        success: false,
        message:
          "Required sheets (user, tashbih_data) not found. Please create these sheets with proper headers.",
        missingSheets: {
          user: !userSheet,
          tashbih_data: !dataSheet,
        },
      });
    }

    // Handle createUser action
    if (action === "createUser") {
      var userId = params.userId;
      var name = params.name;
      var password = params.password;
      if (!userId || !name || !password)
        return jsonResponse({ success: false, message: "Missing fields" });

      // check duplicate userId
      var users = userSheet
        .getRange(2, 1, userSheet.getLastRow() - 1, 1)
        .getValues()
        .flat();
      if (users.indexOf(userId) !== -1) {
        return jsonResponse({
          success: false,
          message: "UserID already exists",
        });
      }
      // append new user
      userSheet.appendRow([userId, name, password]);
      return jsonResponse({ success: true, message: "User created" });
    }

    // Handle checkUserId action
    if (action === "checkUserId") {
      var userId = params.userId;
      if (!userId)
        return jsonResponse({ success: false, message: "Missing userId" });

      try {
        var users = userSheet
          .getRange(2, 1, userSheet.getLastRow() - 1, 1)
          .getValues()
          .flat();
        var available = users.indexOf(userId) === -1;
        return jsonResponse({ success: true, available: available });
      } catch (err) {
        return jsonResponse({
          success: false,
          message: "Error checking user ID",
        });
      }
    }

    // Handle login action

    // Handle login action
    if (action === "login") {
      var userId = params.userId;
      var password = params.password;
      if (!userId || !password)
        return jsonResponse({ success: false, message: "Missing credentials" });

      var lastRow = userSheet.getLastRow();
      if (lastRow < 2)
        return jsonResponse({ success: false, message: "User not found" });

      var range = userSheet.getRange(2, 1, lastRow - 1, 3);
      var vals = range.getValues();
      for (var i = 0; i < vals.length; i++) {
        if (
          String(vals[i][0]) === String(userId) &&
          String(vals[i][2]) === String(password)
        ) {
          return jsonResponse({ success: true, name: vals[i][1] });
        }
      }
      return jsonResponse({ success: false, message: "Invalid credentials" });
    }

    // Handle saveTasbih action - UPDATE existing entries instead of appending
    if (action === "saveTasbih") {
      var userId = params.userId;
      var name = params.name || "";
      var dataStr = params.data;
      if (!userId || !dataStr)
        return jsonResponse({ success: false, message: "Missing data" });

      // dataStr expected to be JSON: { counts: { 'SubhanAllah': 20, ... } }
      try {
        var payload = JSON.parse(dataStr);
      } catch (err) {
        return jsonResponse({ success: false, message: "Invalid JSON data" });
      }

      var counts = payload.counts || payload; // maybe payload itself is counts

      var ts = new Date();
      var tz = ss.getSpreadsheetTimeZone();
      var targetDateStr = date || Utilities.formatDate(ts, tz, "yyyy-MM-dd");

      console.log("Saving counts for user:", userId, "on date:", targetDateStr);
      console.log("Counts to save:", counts);

      try {
        var rows = dataSheet.getDataRange().getValues();
        var updatedRows = [];
        var foundUpdates = {};

        // First pass: find existing entries for today + userId + tasbihName and update them
        for (var i = 1; i < rows.length; i++) {
          // Skip header row
          var row = rows[i];
          var rowDate = row[0];
          var rowUser = String(row[1] || "");
          var rowTasbih = String(row[3] || "");

          // Parse row date
          var rowDateStr = "";
          if (rowDate instanceof Date) {
            rowDateStr = Utilities.formatDate(rowDate, tz, "yyyy-MM-dd");
          } else if (
            typeof rowDate === "string" &&
            rowDate.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)
          ) {
            // Handle MM/dd/yyyy format
            var parts = rowDate.split("/");
            var parsedDate = new Date(parts[2], parts[0] - 1, parts[1]);
            rowDateStr = Utilities.formatDate(parsedDate, tz, "yyyy-MM-dd");
          }

          // Check if this row matches target date + userId + tasbihName
          if (
            rowDateStr === targetDateStr &&
            rowUser === String(userId) &&
            counts.hasOwnProperty(rowTasbih)
          ) {
            // Update this row with new count
            var newCount = Number(counts[rowTasbih]) || 0;
            if (newCount > 0) {
              updatedRows.push([ts, userId, name, rowTasbih, newCount]); // No SessionID
              foundUpdates[rowTasbih] = true;
              console.log(
                "Updated existing row for",
                rowTasbih,
                "to count:",
                newCount
              );
            }
            // Skip this row (don't include in final data)
          } else {
            // Keep existing row as-is
            updatedRows.push(row);
          }
        }

        // Second pass: add new entries for tasbihs that don't exist yet
        for (var tasbihName in counts) {
          if (!counts.hasOwnProperty(tasbihName) || foundUpdates[tasbihName])
            continue;

          var cnt = Number(counts[tasbihName]) || 0;
          if (cnt > 0) {
            updatedRows.push([ts, userId, name, tasbihName, cnt]); // No SessionID
            console.log("Added new row for", tasbihName, "with count:", cnt);
          }
        }

        // Clear the sheet and write all data back
        dataSheet.clear();
        // Write header
        dataSheet.appendRow([
          "Timestamp",
          "UserID",
          "Name",
          "TasbihName",
          "Count",
        ]);
        // Write all data
        if (updatedRows.length > 0) {
          dataSheet
            .getRange(2, 1, updatedRows.length, 5)
            .setValues(updatedRows);
        }

        var savedCount = Object.keys(counts).length;
        return jsonResponse({
          success: true,
          message: "Updated " + savedCount + " tasbih entries for today",
        });
      } catch (err) {
        console.error("Error in saveTasbih:", err);
        return jsonResponse({
          success: false,
          message: "Error saving to sheet: " + err.message,
          error: err.toString(),
        });
      }
    }

    // Handle getProgress action
    if (action === "getProgress") {
      var userId = params.userId;
      if (!userId)
        return jsonResponse({ success: false, message: "Missing userId" });

      try {
        var rows = dataSheet.getDataRange().getValues();
        console.log("Total rows in sheet:", rows.length);
        console.log("Looking for userId:", userId);

        // rows include header row; find indices from header for safety (but we assume header order)
        // header: Timestamp | UserID | Name | TasbihName | Count
        var totals = {};
        var today = new Date();
        var tz = ss.getSpreadsheetTimeZone();
        var todayStr = Utilities.formatDate(today, tz, "yyyy-MM-dd");

        console.log("Today's date string:", todayStr);
        console.log("Spreadsheet timezone:", tz);

        for (var i = 1; i < rows.length; i++) {
          var row = rows[i];
          var ts = row[0];
          var rowUser = String(row[1] || "");
          var tasbihName = row[3];
          var cnt = Number(row[4]) || 0;

          console.log(
            "Row",
            i,
            "- User:",
            rowUser,
            "Tasbih:",
            tasbihName,
            "Count:",
            cnt,
            "Date:",
            ts
          );

          if (rowUser !== String(userId)) {
            console.log("Skipping - wrong user");
            continue;
          }

          // check same day
          var rowDateStr = "";
          if (ts instanceof Date) {
            rowDateStr = Utilities.formatDate(ts, tz, "yyyy-MM-dd");
            console.log("Date is Date object, formatted:", rowDateStr);
          } else if (typeof ts === "string") {
            // Handle different date formats that might be in the sheet
            try {
              // Try parsing MM/dd/yyyy format (like 9/22/2025)
              if (ts.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
                var parts = ts.split("/");
                var parsedDate = new Date(parts[2], parts[0] - 1, parts[1]);
                rowDateStr = Utilities.formatDate(parsedDate, tz, "yyyy-MM-dd");
                console.log("Parsed MM/dd/yyyy date:", ts, "to:", rowDateStr);
              } else {
                rowDateStr = Utilities.formatDate(
                  new Date(ts),
                  tz,
                  "yyyy-MM-dd"
                );
                console.log("Date parsed from string:", rowDateStr);
              }
            } catch (e) {
              console.log("Could not parse date string:", ts);
              rowDateStr = "";
            }
          } else {
            console.log("Unknown date type:", typeof ts, ts);
            rowDateStr = "";
          }

          console.log("Comparing", rowDateStr, "with", todayStr);

          if (rowDateStr === todayStr) {
            console.log("Date matches! Adding", cnt, "to", tasbihName);
            totals[tasbihName] = (totals[tasbihName] || 0) + cnt;
          } else {
            console.log("Date does not match");
          }
        }

        console.log("Final totals:", totals);

        // if no entries, return empty object
        return jsonResponse(totals);
      } catch (err) {
        console.error("Error in getProgress:", err);
        return jsonResponse({
          success: false,
          message: "Error reading progress: " + err.message,
          error: err.toString(),
        });
      }
    }

    return jsonResponse({
      success: false,
      message: "Unknown action: " + action,
    });
  } catch (globalError) {
    // Catch any unexpected errors
    return jsonResponse({
      success: false,
      message: "Unexpected error occurred: " + globalError.message,
      error: globalError.toString(),
      stack: globalError.stack,
    });
  }
}

// Handle GET requests (though we mainly use POST)
function doGet(e) {
  try {
    return jsonResponse({
      success: true,
      message: "Tasbih Tracker Apps Script is running",
      timestamp: new Date().toISOString(),
      note: "Use POST requests for API calls",
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      message: "Error in doGet: " + error.message,
      error: error.toString(),
    });
  }
}

// Helpers
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
