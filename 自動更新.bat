@echo off
rem コードページをUTF-8に設定
chcp 65001 > nul

echo ===================================================
echo 🔞 羞恥特化型同人レビュー自動更新システム 起動
echo ===================================================

echo.
echo [STEP 1/3] 🔄 最新情報を取得してAIレビュー執筆中...
echo ---------------------------------------------------
call node app.js

if %errorlevel% neq 0 (
    echo.
    echo ❌ node app.js の実行中にエラーが発生しました。
    echo LM Studioが起動しているか確認してください。
    pause
    exit /b
)

echo.
echo [STEP 2/3] 🔗 GitHubへの接続先を最新化中...
echo ---------------------------------------------------
git remote set-url origin https://github.com/hasu6135/ec-finder.git
if %errorlevel% neq 0 (
    git remote add origin https://github.com/hasu6135/ec-finder.git
)

echo.
echo [STEP 3/3] 🚀 更新されたページをGitHubへプッシュ中...
echo ---------------------------------------------------
git add .
git commit -m "バッチファイルによる同人レビュー自動更新"
git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo ❌ GitHubへのアップロードに失敗しました。
    pause
    exit /b
)

echo.
echo ===================================================
echo ✨ すべての処理が正常に完了しました！
echo Cloudflare Pages側のサイトが自動更新されます。
echo ===================================================
timeout /t 30