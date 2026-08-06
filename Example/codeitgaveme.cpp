#include <bits/stdc++.h>
using namespace std;

int main() {
    int n;
    cin >> n;
    vector<int> arr(n);
    for (int i = 0; i < n; ++i) {
        cin >> arr[i];
    }
    vector<int> dp(101, 0);
    int max_len = 0;
    for (int x : arr) {
        int prev = 0;
        if (x - 1 >= 0) prev = max(prev, dp[x-1]);
        prev = max(prev, dp[x]);
        if (x + 1 <= 100) prev = max(prev, dp[x+1]);
        dp[x] = max(dp[x], prev + 1);
        if (dp[x] > max_len) max_len = dp[x];
    }
    cout << max_len << endl;
    return 0;
}