// Extension Detection Test Script
// Copy and paste this into your browser console (F12) to test extension detection

console.log("🔍 [TEST] Starting Extension Detection Test...");
console.log("=".repeat(60));

// Test known extensions
const testExtensions = [
  { id: 'kbfnbcaeplbcioakkpcpgfkobkghlhen', name: 'Grammarly', file: 'src/css/Grammarly.styles.css' },
  { id: 'fdpohaocaechififmbbbbbknoalclacl', name: 'GoFullPage', file: 'icon.png' },
  { id: 'hkelihkpggjbkmggidgagbkjokfnaknh', name: 'Responsive Viewer', file: 'icon.png' },
  { id: 'hdokiejnpimakedhajhdlcegeplioahd', name: 'LastPass', file: 'images/icon.png' },
  { id: 'jmlaanjgllfidfhohpempmalomfpjbjj', name: 'ChatGPT for Google', file: 'logo.png' },
];

let detectedCount = 0;
let notDetectedCount = 0;

async function testExtension(ext) {
  const url = `chrome-extension://${ext.id}/${ext.file}`;
  
  try {
    // Try image load first
    const img = new Image();
    const imgPromise = new Promise((resolve) => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
    
    const imgResult = await Promise.race([
      imgPromise,
      new Promise(resolve => setTimeout(() => resolve(false), 100))
    ]);
    
    if (imgResult) {
      console.log(`✅ [DETECTED] ${ext.name} (via image)`);
      detectedCount++;
      return true;
    }
    
    // Try fetch as fallback
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        console.log(`✅ [DETECTED] ${ext.name} (via fetch)`);
        detectedCount++;
        return true;
      }
    } catch (e) {
      // Fetch failed
    }
    
    console.log(`❌ [NOT DETECTED] ${ext.name} (ID: ${ext.id.substring(0, 8)}...)`);
    notDetectedCount++;
    return false;
  } catch (error) {
    console.log(`❌ [ERROR] ${ext.name}: ${error.message}`);
    notDetectedCount++;
    return false;
  }
}

async function runTests() {
  console.log(`Testing ${testExtensions.length} known extensions...\n`);
  
  for (const ext of testExtensions) {
    await testExtension(ext);
    await new Promise(resolve => setTimeout(resolve, 50)); // Small delay between tests
  }
  
  console.log("\n" + "=".repeat(60));
  console.log(`📊 [RESULTS] Detected: ${detectedCount} | Not Detected: ${notDetectedCount}`);
  console.log("=".repeat(60));
  
  if (detectedCount > 0) {
    console.log("✅ Extension detection is working!");
  } else {
    console.log("⚠️ No extensions detected. Either:");
    console.log("   1. Extensions are not installed");
    console.log("   2. Extensions don't have web_accessible_resources");
    console.log("   3. Extensions are disabled");
  }
}

// Run tests
runTests();

