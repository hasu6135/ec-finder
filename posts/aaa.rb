require 'find'

puts "=================================================="
puts "  HTMLファイルから [Manga Raw] を一括削除します (Ruby版)"
puts "=================================================="
puts ""
puts "【注意】万が一のため、実行前に必ずフォルダ全体の"
puts "         バックアップ（コピー）を取ってください。"
puts ""
print "準備ができたら Enter キーを押してください..."
gets

puts "\n検索と置換処理を実行中..."
puts "--------------------------------------------------"

match_count = 0

# スクリプトがあるフォルダ以下のすべてのファイルを走査
Find.find('.') do |path|
  # 拡張子が .html または .htm のファイルのみを対象にする
  if File.file?(path) && path =~ /\.html?$/i
    begin
      # Windows環境でも文字化けしないよう、明示的にUTF-8で読み込み
      content = File.read(path, encoding: 'utf-8')
      
      # [Manga Raw] が含まれているか確認
      if content.include?('[Manga Raw]')
        puts "[置換対象を発見]: #{path}"
        
        # 直前の半角スペース、全角スペース、タブを含めて削除
        content.gsub!(/[ \t ]*\[Manga Raw\]/, '')
        
        # UTF-8で上書き保存
        File.write(path, content, encoding: 'utf-8')
        match_count += 1
      end
    rescue => e
      puts "[エラー] ファイルの処理に失敗しました: #{path} (#{e.message})"
    end
  end
end

puts "--------------------------------------------------"
puts "処理が完了しました！"
puts "修正したファイル数: #{match_count} 件"
puts "================================================--"
print "Enter キーを押すと終了します..."
gets